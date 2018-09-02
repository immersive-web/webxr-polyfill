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

import XRPresentationContext from './api/XRPresentationContext';
import {
  POLYFILLED_COMPATIBLE_XR_DEVICE,
  COMPATIBLE_XR_DEVICE,
} from './constants';

const contextTypes = ['webgl', 'experimental-webgl'];

/**
 * Takes the WebGLRenderingContext constructor
 * and creates a `setCompatibleXRDevice` function if it does not exist.
 * Returns a boolean indicating whether or not the function
 * was polyfilled.
 *
 * @param {WebGLRenderingContext}
 * @return {boolean}
 */
export const polyfillSetCompatibleXRDevice = Context => {
  if (typeof Context.prototype.setCompatibleXRDevice === 'function') {
    return false;
  }

  // Create `setCompatibleXRDevice` and if successful, store
  // the XRDevice as a private attribute for error checking
  Context.prototype.setCompatibleXRDevice = function (xrDevice) {
    return new Promise((resolve, reject) => {
      // This is all fake, so accept if you get anything
      // that looks like a XRDevice
      if (xrDevice && typeof xrDevice.requestSession === 'function') {
        resolve();
      } else {
        reject()
      }
    }).then(() => this[COMPATIBLE_XR_DEVICE] = xrDevice);
  };

  return true;
};


/**
 * Takes the HTMLCanvasElement or OffscreenCanvas constructor
 * and wraps its `getContext` function to return a XRPresentationContext
 * if requesting a `xrpresent` context type if `renderContextType` set. Also
 * patches context's with a POLYFILLED_COMPATIBLE_XR_DEVICE bit so the API
 * knows it's also working with a polyfilled `compatibleXRDevice` bit.
 * Can do extra checking for validity.
 *
 * @param {HTMLCanvasElement} Canvas
 * @param {String} renderContextType
 */
export const polyfillGetContext = (Canvas, renderContextType) => {
  const getContext = Canvas.prototype.getContext;
  Canvas.prototype.getContext = function (contextType, glAttribs) {

    // If requesting a XRPresentationContext...
    if (renderContextType && contextType === 'xrpresent') {
      let ctx = getContext.call(this, renderContextType, glAttribs);
      return new XRPresentationContext(this, ctx, glAttribs);
    }

    const ctx = getContext.call(this, contextType, glAttribs);

    // Set this bit so the API knows the WebGLRenderingContext is
    // also polyfilled a bit
    ctx[POLYFILLED_COMPATIBLE_XR_DEVICE] = true;

    // If we've polyfilled WebGLRenderingContext's compatibleXRDevice
    // bit, store the XRDevice in the private token if created via
    // creation parameters
    if (glAttribs && ('compatibleXRDevice' in glAttribs)) {
      ctx[COMPATIBLE_XR_DEVICE] = glAttribs.compatibleXRDevice;
    }

    return ctx;
  }
}
