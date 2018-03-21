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
import XRPresentationContext from './XRPresentationContext';
import XRPresentationFrame from './XRPresentationFrame';
import XRStageBounds from './XRStageBounds';
import XRFrameOfReference, {
  XRFrameOfReferenceTypes,
  XRFrameOfReferenceOptions,
} from './XRFrameOfReference';

const PRIVATE = Symbol('@@webxr-polyfill/XRSession');

export const XRSessionCreationOptions = Object.freeze({
  exclusive: false,
  outputContext: undefined,
});

/**
 * @param {XRSessionCreationOptions} options
 * @return boolean
 */
export const validateSessionOptions = options => {
  const { exclusive, outputContext } = options;

  // If not an exclusive session, an outputContext must be defined
  if (!exclusive && !outputContext) {
    return false;
  }

  // If outputContext exists, it must be a XRPresentationContext
  if (outputContext !== undefined && !(outputContext instanceof XRPresentationContext)) {
    return false;
  }

  return true;
};

export default class XRSession extends EventTarget {
  /**
   * @param {PolyfilledXRDevice} polyfill
   * @param {XRDevice} device
   * @param {XRSessionCreationOptions} sessionOptions
   * @param {number} id
   */
  constructor(polyfill, device, sessionOptions, id) {
    sessionOptions = Object.assign({}, XRSessionCreationOptions, sessionOptions);

    super();

    const { exclusive, outputContext } = sessionOptions;

    this[PRIVATE] = {
      polyfill,
      device,
      exclusive,
      outputContext,
      ended: false,
      suspended: false,
      suspendedCallback: null,
      id,
    };

    const frame = new XRPresentationFrame(polyfill, this, this[PRIVATE].id);
    this[PRIVATE].frame = frame;

    // Hook into the PolyfilledXRDisplay's `vr-present-end` event so we can
    // wrap up things here if we're cut off from the underlying
    // polyfilled device or explicitly ended via `session.end()` for this
    // session.
    this[PRIVATE].onPresentationEnd = sessionId => {
      // If this session was suspended, resume it now that an exclusive
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

      // Otherwise, this is the exclusive session that has ended.
      // Set `ended` to true so we can disable all functionality
      // in this XRSession
      this[PRIVATE].ended = true;
      polyfill.removeEventListener('@webvr-polyfill/vr-present-end', this[PRIVATE].onPresentationEnd);
      polyfill.removeEventListener('@webvr-polyfill/vr-present-start', this[PRIVATE].onPresentationStart);
      this.dispatchEvent('end', { session: this });
    };
    polyfill.addEventListener('@@webxr-polyfill/vr-present-end', this[PRIVATE].onPresentationEnd);


    // Hook into the PolyfilledXRDisplay's `vr-present-start` event so we can
    // suspend if another session has begun exclusive presentation.
    this[PRIVATE].onPresentationStart = sessionId => {
      // Ignore if this is the session that has begun exclusive presenting
      if (sessionId === this[PRIVATE].id) {
        return;
      }

      this[PRIVATE].suspended = true;
      this.dispatchEvent('blur', { session: this });
    };
    polyfill.addEventListener('@@webxr-polyfill/vr-present-start', this[PRIVATE].onPresentationStart);

    this.onblur = undefined;
    this.onfocus = undefined;
    this.onresetpose = undefined;
    this.onend = undefined;
  }

  /**
   * @return {XRDevice}
   */
  get device() { return this[PRIVATE].device; }

  /**
   * @return {boolean}
   */
  get exclusive() { return this[PRIVATE].exclusive; }

  /**
   * @return {WebGLRenderingContext}
   */
  get outputContext() { return this[PRIVATE].outputContext; }

  /**
   * @return {number}
   */
  get depthNear() { return this[PRIVATE].polyfill.depthNear; }

  /**
   * @param {number}
   */
  set depthNear(value) { this[PRIVATE].polyfill.depthNear = value; }

  /**
   * @return {number}
   */
  get depthFar() { return this[PRIVATE].polyfill.depthFar; }

  /**
   * @param {number}
   */
  set depthFar(value) { this[PRIVATE].polyfill.depthFar = value; }

  /**
   * @return {XRLayer}
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
    // Report to the polyfill since it'll need
    // to handle the layer for rendering
    this[PRIVATE].polyfill.onBaseLayerSet(this[PRIVATE].id, value);
  }

  /**
   * @return {XRFrameOfReference}
   */
  async requestFrameOfReference(type, options={}) {
    if (this[PRIVATE].ended) {
      return;
    }

    options = Object.assign({}, XRFrameOfReferenceOptions, options);

    if (!XRFrameOfReferenceTypes.includes(type)) {
      throw new Error(`XRFrameOfReferenceType must be one of ${XRFrameOfReferenceTypes}`);
    }

    let transform = null;
    let bounds = null;
    // Request a transform from the polyfill given the values. If returning a transform
    // (probably "stage"), use it, and if undefined, XRFrameOfReference will use a default
    // transform. This call can throw, rejecting the promise, indicating the polyfill does
    // not support that frame of reference.
    try {
      transform = await this[PRIVATE].polyfill.requestFrameOfReferenceTransform(type, options);
    } catch (e) {
      // Check to see if stage frame of reference failed for this
      // PolyfilledXRDevice and we aren't disabling stage emulation.
      // Don't throw in this case, and let XRFrameOfReference use its
      // stage emulation.
      if (type !== 'stage' || options.disableStageEmulation) {
        throw e;
      }
    }

    if (type === 'stage' && transform) {
      bounds = this[PRIVATE].polyfill.requestStageBounds();
      if (bounds) {
        bounds = new XRStageBounds(bounds);
      }
    }

    return new XRFrameOfReference(this[PRIVATE].polyfill, type, options, transform, bounds);
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

    return this[PRIVATE].polyfill.requestAnimationFrame(() => {
      this[PRIVATE].polyfill.onFrameStart();
      callback(now(), this[PRIVATE].frame);
      this[PRIVATE].polyfill.onFrameEnd(this[PRIVATE].id);
    });
  }

  /**
   * @param {number} handle
   */
  cancelAnimationFrame(handle) {
    if (this[PRIVATE].ended) {
      return;
    }

    this[PRIVATE].polyfill.cancelAnimationFrame(handle);
  }

  async end() {
    if (this[PRIVATE].ended) {
      return;
    }

    // If this is an exclusive session, trigger the platform to end, which
    // will call the `onPresentationEnd` handler, wrapping this up.
    if (!this.exclusive) {
      this[PRIVATE].ended = true;
      this[PRIVATE].polyfill.removeEventListener('@@webvr-polyfill/vr-present-start',
                                                 this[PRIVATE].onPresentationStart);
      this[PRIVATE].polyfill.removeEventListener('@@webvr-polyfill/vr-present-end',
                                                 this[PRIVATE].onPresentationEnd);

      this.dispatchEvent('end', { session: this });
    }

    return this[PRIVATE].polyfill.endSession(this[PRIVATE].id);
  }
}
