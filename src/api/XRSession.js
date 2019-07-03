/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import EventTarget from '../lib/EventTarget';
import now from '../lib/now';
import XRFrame from './XRFrame';
import XRReferenceSpace, {
  XRReferenceSpaceTypes
} from './XRReferenceSpace';
import XRWebGLLayer from './XRWebGLLayer';

export const PRIVATE = Symbol('@@webxr-polyfill/XRSession');

export default class XRSession extends EventTarget {
  /**
   * @param {XRDevice} device
   * @param {XRSessionMode} mode
   * @param {number} id
   */
  constructor(device, mode, id) {
    super();

    let immersive = mode != 'inline';
    let outputContext = null;

    this[PRIVATE] = {
      device,
      mode,
      immersive,
      outputContext,
      ended: false,
      suspended: false,
      suspendedCallback: null,
      id,
      activeRenderState: null,
      pendingRenderState: null,
    };

    const frame = new XRFrame(device, this, this[PRIVATE].id);
    this[PRIVATE].frame = frame;

    // Hook into the XRDisplay's `vr-present-end` event so we can
    // wrap up things here if we're cut off from the underlying
    // polyfilled device or explicitly ended via `session.end()` for this
    // session.
    this[PRIVATE].onPresentationEnd = sessionId => {
      // If this session was suspended, resume it now that an immersive
      // session has ended.
      if (sessionId !== this[PRIVATE].id) {
        this[PRIVATE].suspended = false;

        this.dispatchEvent('focus', { session: this });
        const suspendedCallback = this[PRIVATE].suspendedCallback;
        this[PRIVATE].suspendedCallback = null;
        if (suspendedCallback) {
          this.requestAnimationFrame(suspendedCallback);
        }
        return;
      }

      // Otherwise, this is the immersive session that has ended.
      // Set `ended` to true so we can disable all functionality
      // in this XRSession
      this[PRIVATE].ended = true;
      device.removeEventListener('@webvr-polyfill/vr-present-end', this[PRIVATE].onPresentationEnd);
      device.removeEventListener('@webvr-polyfill/vr-present-start', this[PRIVATE].onPresentationStart);
      device.removeEventListener('@@webvr-polyfill/input-select-start', this[PRIVATE].onSelectStart);
      device.removeEventListener('@@webvr-polyfill/input-select-end', this[PRIVATE].onSelectEnd);
      this.dispatchEvent('end', { session: this });
    };
    device.addEventListener('@@webxr-polyfill/vr-present-end', this[PRIVATE].onPresentationEnd);

    // Hook into the XRDisplay's `vr-present-start` event so we can
    // suspend if another session has begun immersive presentation.
    this[PRIVATE].onPresentationStart = sessionId => {
      // Ignore if this is the session that has begun immersive presenting
      if (sessionId === this[PRIVATE].id) {
        return;
      }

      this[PRIVATE].suspended = true;
      this.dispatchEvent('blur', { session: this });
    };
    device.addEventListener('@@webxr-polyfill/vr-present-start', this[PRIVATE].onPresentationStart);

    this[PRIVATE].onSelectStart = evt => {
      // Ignore if this event is not for this session.
      if (evt.sessionId !== this[PRIVATE].id) {
        return;
      }

      this.dispatchEvent('selectstart', {
        frame: this[PRIVATE].frame,
        inputSource: evt.inputSource
      });
    };
    device.addEventListener('@@webxr-polyfill/input-select-start', this[PRIVATE].onSelectStart);

    this[PRIVATE].onSelectEnd = evt => {
      // Ignore if this event is not for this session.
      if (evt.sessionId !== this[PRIVATE].id) {
        return;
      }

      this.dispatchEvent('selectend', {
        frame: this[PRIVATE].frame,
        inputSource: evt.inputSource
      });

      // Sadly, there's no way to make this a user gesture.
      this.dispatchEvent('select',  {
        frame: this[PRIVATE].frame,
        inputSource: evt.inputSource
      });
    };
    device.addEventListener('@@webxr-polyfill/input-select-end', this[PRIVATE].onSelectEnd);

    this.onblur = undefined;
    this.onfocus = undefined;
    this.onresetpose = undefined;
    this.onend = undefined;
    this.onselect = undefined;
    this.onselectstart = undefined;
    this.onselectend = undefined;
  }

  /**
   * @return {XRRenderState}
   */
  get renderState() { return this[PRIVATE].activeRenderState; }

  /**
   * @return {boolean}
   */
  get immersive() { return this[PRIVATE].immersive; }

  /**
   * @return {WebGLRenderingContext}
   */
  get outputContext() { return this[PRIVATE].outputContext; }

  /**
   * @return {number}
   */
  get depthNear() { return this[PRIVATE].device.depthNear; }

  /**
   * @param {number}
   */
  set depthNear(value) { this[PRIVATE].device.depthNear = value; }

  /**
   * @return {number}
   */
  get depthFar() { return this[PRIVATE].device.depthFar; }

  /**
   * @param {number}
   */
  set depthFar(value) { this[PRIVATE].device.depthFar = value; }

  /**
   * @return {XREnvironmentBlendMode}
   */
  get environmentBlendMode() {
    return this[PRIVATE].device.environmentBlendMode || 'opaque';
  }

  /**
   * @return {XRWebGLLayer}
   */
  get baseLayer() { return this[PRIVATE].baseLayer; }

  /**
   * @param {baseLayer} value
   */
  set baseLayer(value) {
    if (this[PRIVATE].ended) {
      return;
    }

    this[PRIVATE].baseLayer = value;
    // Report to the device since it'll need
    // to handle the layer for rendering
    this[PRIVATE].device.onBaseLayerSet(this[PRIVATE].id, value);
  }

  /**
   * @param {string} type
   * @return {XRReferenceSpace}
   */
  async requestReferenceSpace(type) {
    if (this[PRIVATE].ended) {
      return;
    }

    // 'unbounded' is unlikely to ever be supported by the polyfill, since it's
    // pretty much impossible to do correctly without native support.
    if (type === 'unbounded') {
      throw new NotSupportedError(`The WebXR polyfill does not support the ${type} reference space`);
    }

    if (!XRReferenceSpaceTypes.includes(type)) {
      throw new TypeError(`XRReferenceSpaceType must be one of ${XRReferenceSpaceTypes}`);
    }

    // Request a transform from the device given the values. If returning a
    // transform (probably "local-floor" or "bounded-floor"), use it, and if
    // undefined, XRReferenceSpace will use a default transform. This call can
    // throw, rejecting the promise, indicating the device does not support that
    // frame of reference.
    let transform = await this[PRIVATE].device.requestFrameOfReferenceTransform(type);

    // TODO: 'bounded-floor' is only blocked because we currently don't report
    // the bounds geometry correctly.
    if (type === 'bounded-floor') {
      if (!transform) {
        // 'bounded-floor' spaces must have a transform supplied by the device.
        throw new NotSupportedError(`${type} XRReferenceSpace not supported by this device.`);
      }
      
      let bounds = this[PRIVATE].device.requestStageBounds();
      if (!bounds) {
        // 'bounded-floor' spaces must have bounds geometry.
        throw new NotSupportedError(`${type} XRReferenceSpace not supported by this device.`);
        
      }
      // TODO: Create an XRBoundedReferenceSpace with the correct boundaries.
      throw new NotSupportedError(`The WebXR polyfill does not support the ${type} reference space yet.`);
    }

    return new XRReferenceSpace(this[PRIVATE].device, type, transform);
  }

  /**
   * @TODO see about reusing a wrapper function instead of recreating
   * it on every frame if passed in the same `callback`
   *
   * @param {Function} callback
   * @return {number}
   */
  requestAnimationFrame(callback) {
    if (this[PRIVATE].ended) {
      return;
    }

    // If the session is suspended and we have a previously saved
    // suspendedCallback, abort this call
    if (this[PRIVATE].suspended && this[PRIVATE].suspendedCallback) {
      return;
    }

    // Otherwise, if the session is suspended but has not yet creating
    // the suspended callback, do so. It will resume once it is no
    // longer suspended.
    if (this[PRIVATE].suspended && !this[PRIVATE].suspendedCallback) {
      this[PRIVATE].suspendedCallback = callback;
    }

    // TODO: Should pending render state be applied before or after onFrameStart?
    return this[PRIVATE].device.requestAnimationFrame(() => {
      if (this[PRIVATE].pendingRenderState !== null) {
        // Apply pending render state.
        this[PRIVATE].activeRenderState = this[PRIVATE].pendingRenderState;
        this[PRIVATE].pendingRenderState = null;

        // TODO: set compositionDisabled

        // Report to the device since it'll need to handle the layer for rendering.
        if (this[PRIVATE].activeRenderState.baseLayer) {
          this[PRIVATE].device.onBaseLayerSet(
            this[PRIVATE].id,
            this[PRIVATE].activeRenderState.baseLayer);
        }

        if (this[PRIVATE].activeRenderState.inlineVerticalFieldOfView) {
          this[PRIVATE].device.onInlineVerticalFieldOfViewSet(
            this[PRIVATE].id,
            this[PRIVATE].activeRenderState.inlineVerticalFieldOfView);
        }
      }
      this[PRIVATE].device.onFrameStart(this[PRIVATE].id);
      callback(now(), this[PRIVATE].frame);
      this[PRIVATE].device.onFrameEnd(this[PRIVATE].id);
    });
  }

  /**
   * @param {number} handle
   */
  cancelAnimationFrame(handle) {
    if (this[PRIVATE].ended) {
      return;
    }

    this[PRIVATE].device.cancelAnimationFrame(handle);
  }

  /**
   * @return {Array<XRInputSource>} input sources
   */
  get inputSources() {
    return this[PRIVATE].device.getInputSources();
  }

  /**
   * @return {Promise<void>}
   */
  async end() {
    if (this[PRIVATE].ended) {
      return;
    }

    // If this is an immersive session, trigger the platform to end, which
    // will call the `onPresentationEnd` handler, wrapping this up.
    if (!this.immersive) {
      this[PRIVATE].ended = true;
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/vr-present-start',
                                                 this[PRIVATE].onPresentationStart);
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/vr-present-end',
                                                 this[PRIVATE].onPresentationEnd);
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/input-select-start',
                                                 this[PRIVATE].onSelectStart);
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/input-select-end',
                                                 this[PRIVATE].onSelectEnd);

      this.dispatchEvent('end', { session: this });
    }

    return this[PRIVATE].device.endSession(this[PRIVATE].id);
  }

  /**
   * Queues an update to the active render state to be applied on the next
   * frame. Unset fields of newState will not be changed.
   * 
   * @param {XRRenderStateInit?} newState 
   */
  updateRenderState(newState) {
    if (this[PRIVATE].ended) {
      const message = "Can't call updateRenderState on an XRSession " +
                      "that has already ended.";
      throw new Error(message);
    }

    if (newState.baseLayer && (newState.baseLayer._session !== this)) {
      const message = "Called updateRenderState with a base layer that was " +
                      "created by a different session.";
      throw new Error(message);
    }

    const fovSet = (newState.inlineVerticalFieldOfView !== null) &&
                   (newState.inlineVerticalFieldOfView !== undefined);

    if (fovSet) {
      if (this[PRIVATE].immersive) {
        const message = "inlineVerticalFieldOfView must not be set for an " +
                        "XRRenderState passed to updateRenderState for an " +
                        "immersive session.";
        throw new Error(message);
      } else {
        // Clamp the inline FoV to a sane range.
        newState.inlineVerticalFieldOfView = Math.min(
          3.13, Math.max(0.01, newState.inlineVerticalFieldOfView));
      }
    }

    if (this[PRIVATE].pendingRenderState === null) {
      // Clone pendingRenderState and override any fields that are set by newState.
      this[PRIVATE].pendingRenderState = Object.assign(
        {}, this[PRIVATE].activeRenderState, newState);
    }
  }
}
