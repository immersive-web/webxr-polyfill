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
  POLYFILLED_XR_COMPATIBLE,
  XR_COMPATIBLE,
} from './constants';

const contextTypes = ['webgl', 'experimental-webgl'];

/**
 * Takes the WebGLRenderingContext constructor
 * and creates a `makeXRCompatible` function if it does not exist.
 * Returns a boolean indicating whether or not the function
 * was polyfilled.
 *
 * @param {WebGLRenderingContext}
 * @return {boolean}
 */
export const polyfillMakeXRCompatible = Context => {
  if (typeof Context.prototype.makeXRCompatible === 'function') {
    return false;
  }

  // Create `makeXRCompatible` and if successful, store
  // the XRDevice as a private attribute for error checking
  Context.prototype.makeXRCompatible = function () {
    this[XR_COMPATIBLE] = true;
    // This is all fake, so just resolve immediately.
    return Promise.resolve();
  };

  return true;
};


/**
 * Takes the HTMLCanvasElement or OffscreenCanvas constructor
 * and wraps its `getContext` function to return a XRPresentationContext
 * if requesting a `xrpresent` context type if `renderContextType` set. Also
 * patches context's with a POLYFILLED_XR_COMPATIBLE bit so the API
 * knows it's also working with a polyfilled `xrCompatible` bit.
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
    ctx[POLYFILLED_XR_COMPATIBLE] = true;

    // If we've polyfilled WebGLRenderingContext's xrCompatible
    // bit, store the boolean in the private token if created via
    // creation parameters
    if (glAttribs && ('xrCompatible' in glAttribs)) {
      ctx[XR_COMPATIBLE] = glAttribs.xrCompatible;
    }

    return ctx;
  }
}
