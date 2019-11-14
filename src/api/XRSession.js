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
import XRRenderState from './XRRenderState';
import XRWebGLLayer from './XRWebGLLayer';
import XRInputSourceEvent from './XRInputSourceEvent';
import XRSessionEvent from './XRSessionEvent';
import XRInputSourcesChangeEvent from './XRInputSourcesChangeEvent';

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

    this[PRIVATE] = {
      device,
      mode,
      immersive,
      ended: false,
      suspended: false,
      suspendedCallback: null,
      id,
      activeRenderState: new XRRenderState(),
      pendingRenderState: null,
      currentInputSources: []
    };

    const frame = new XRFrame(device, this, immersive, this[PRIVATE].id);
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
      this.dispatchEvent('end', new XRSessionEvent('end', { session: this }));
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

      this.dispatchEvent('selectstart', new XRInputSourceEvent('selectstart', {
        frame: this[PRIVATE].frame,
        inputSource: evt.inputSource
      }));
    };
    device.addEventListener('@@webxr-polyfill/input-select-start', this[PRIVATE].onSelectStart);

    this[PRIVATE].onSelectEnd = evt => {
      // Ignore if this event is not for this session.
      if (evt.sessionId !== this[PRIVATE].id) {
        return;
      }

      this.dispatchEvent('selectend', new XRInputSourceEvent('selectend', {
        frame: this[PRIVATE].frame,
        inputSource: evt.inputSource
      }));

      // Sadly, there's no way to make this a user gesture.
      this.dispatchEvent('select',  new XRInputSourceEvent('select', {
        frame: this[PRIVATE].frame,
        inputSource: evt.inputSource
      }));
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
   * @return {XREnvironmentBlendMode}
   */
  get environmentBlendMode() {
    return this[PRIVATE].device.environmentBlendMode || 'opaque';
  }

  /**
   * @param {string} type
   * @return {XRReferenceSpace}
   */
  async requestReferenceSpace(type) {
    if (this[PRIVATE].ended) {
      return;
    }

    if (!XRReferenceSpaceTypes.includes(type)) {
      throw new TypeError(`XRReferenceSpaceType must be one of ${XRReferenceSpaceTypes}`);
    }

    if (!this[PRIVATE].device.doesSessionSupportReferenceSpace(this[PRIVATE].id, type)) {
      throw new DOMException(`The ${type} reference space is not supported by this session.`, 'NotSupportedError');
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
        throw new DOMException(`${type} XRReferenceSpace not supported by this device.`, 'NotSupportedError');
      }
      
      let bounds = this[PRIVATE].device.requestStageBounds();
      if (!bounds) {
        // 'bounded-floor' spaces must have bounds geometry.
        throw new DOMException(`${type} XRReferenceSpace not supported by this device.`, 'NotSupportedError');
        
      }
      // TODO: Create an XRBoundedReferenceSpace with the correct boundaries.
      throw new DOMException(`The WebXR polyfill does not support the ${type} reference space yet.`, 'NotSupportedError');
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
        this[PRIVATE].activeRenderState = new XRRenderState(this[PRIVATE].pendingRenderState);
        this[PRIVATE].pendingRenderState = null;

        // Report to the device since it'll need to handle the layer for rendering.
        if (this[PRIVATE].activeRenderState.baseLayer) {
          this[PRIVATE].device.onBaseLayerSet(
            this[PRIVATE].id,
            this[PRIVATE].activeRenderState.baseLayer);
        }
      }
      this[PRIVATE].device.onFrameStart(this[PRIVATE].id, this[PRIVATE].activeRenderState);
      // inputSources can be populated in .onFrameStart()
      // so check the change and fire inputsourceschange event if needed
      this._checkInputSourcesChange();
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
    if (this.immersive) {
      this[PRIVATE].ended = true;
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/vr-present-start',
                                                 this[PRIVATE].onPresentationStart);
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/vr-present-end',
                                                 this[PRIVATE].onPresentationEnd);
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/input-select-start',
                                                 this[PRIVATE].onSelectStart);
      this[PRIVATE].device.removeEventListener('@@webvr-polyfill/input-select-end',
                                                 this[PRIVATE].onSelectEnd);

      this.dispatchEvent('end', new XRSessionEvent('end', { session: this }));
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
      const activeRenderState = this[PRIVATE].activeRenderState;
      this[PRIVATE].pendingRenderState = {
        depthNear: activeRenderState.depthNear,
        depthFar: activeRenderState.depthFar,
        inlineVerticalFieldOfView: activeRenderState.inlineVerticalFieldOfView,
        baseLayer: activeRenderState.baseLayer
      };
    }
    Object.assign(this[PRIVATE].pendingRenderState, newState);
  }

  /**
   * Compares the inputSources with the ones in the previous frame.
   * Fires imputsourceschange event if any added or removed
   * inputSource is found.
   */
  _checkInputSourcesChange() {
    const added = [];
    const removed = [];
    const newInputSources = this.inputSources;
    const oldInputSources = this[PRIVATE].currentInputSources;

    for (const newInputSource of newInputSources) {
      if (!oldInputSources.includes(newInputSource)) {
        added.push(newInputSource);
      }
    }

    for (const oldInputSource of oldInputSources) {
      if (!newInputSources.includes(oldInputSource)) {
        removed.push(oldInputSource);
      }
    }

    if (added.length > 0 || removed.length > 0) {
      this.dispatchEvent('inputsourceschange', new XRInputSourcesChangeEvent('inputsourceschange', {
        session: this,
        added: added,
        removed: removed
      }));
    }

    this[PRIVATE].currentInputSources.length = 0;
    for (const newInputSource of newInputSources) {
      this[PRIVATE].currentInputSources.push(newInputSource);
    }
  }
}
