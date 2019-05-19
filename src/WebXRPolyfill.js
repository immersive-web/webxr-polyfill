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

import GLOBAL from './lib/global';
import API from './api/index';
import {
  polyfillMakeXRCompatible,
  polyfillGetContext
} from './polyfill-globals';
import { isImageBitmapSupported, isMobile } from './utils';
import { requestXRDevice } from './devices';

const CONFIG_DEFAULTS = {
  // Whether support for a browser implementing WebVR 1.1 is enabled.
  // If enabled, XR support is powered by native WebVR 1.1 VRDisplays,
  // exposed as XRDevices.
  webvr: true,
  // Whether a CardboardXRDevice should be discoverable if on
  // a mobile device, and no other native (1.1 VRDisplay if `webvr` on,
  // or XRDevice) found.
  cardboard: true,
};

const partials = ['navigator', 'HTMLCanvasElement', 'WebGLRenderingContext'];

export default class WebXRPolyfill {
  /**
   * @param {object} global
   * @param {object?} config
   */
  constructor(global, config={}) {
    this.global = global || GLOBAL;
    this.config = Object.freeze(Object.assign({}, CONFIG_DEFAULTS, config));
    this.nativeWebXR = 'xr' in this.global.navigator;
    this.injected = false;

    // If no native WebXR implementation found, inject one
    if (!this.nativeWebXR) {
      this._injectPolyfill(this.global);
    }
    // If an implementation exists, on mobile, and cardboard enabled,
    // patch `xr.requestDevice` so that we can return a cardboard display
    // if there are no native devices
    else if (this.config.cardboard && isMobile(this.global)) {
      this._patchNavigatorXR();
    }
  }

  _injectPolyfill(global) {
    if (!partials.every(iface => !!global[iface])) {
      throw new Error(`Global must have the following attributes : ${partials}`);
    }

    // Apply classes as globals
    for (const className of Object.keys(API)) {
      if (global[className] !== undefined) {
        console.warn(`${className} already defined on global.`);
      } else {
        global[className] = API[className];
      }
    }

    // Test environment does not have rendering contexts
    if (process.env.NODE_ENV !== 'test') {
      // Attempts to polyfill WebGLRenderingContext's `makeXRCompatible`
      // if it does not exist.
      const polyfilledCtx = polyfillMakeXRCompatible(global.WebGLRenderingContext);

      // If we polyfilled `makeXRCompatible`, also polyfill the context creation
      // parameter `{ xrCompatible }`. Also assume that we need to polyfill
      // `ctx.getContext('xrpresent')`
      if (polyfilledCtx) {
        // Use ImageBitmapRenderingContext if it's supported to implement
        // XRPresentationContext; otherwise use Canvas2DRenderingContext.
        const renderContextType = isImageBitmapSupported(global) ? 'bitmaprenderer' : '2d';
        polyfillGetContext(global.HTMLCanvasElement, renderContextType);

        // If OffscreenCanvas is available, patch its `getContext` method as well
        // for the compatible XRDevice bit, although it cannot create an
        // XRPresentationContext.
        if (global.OffscreenCanvas) {
          polyfillGetContext(global.OffscreenCanvas, null);
        }

        // If we needed to polyfill WebGLRenderingContext, do the same
        // for WebGL2 contexts if it exists.
        if (global.WebGL2RenderingContext){
          polyfillMakeXRCompatible(global.WebGL2RenderingContext);
        }
      }
    }

    this.injected = true;

    this._patchNavigatorXR();
  }

  _patchNavigatorXR() {
    // Request a polyfilled XRDevice.
    let devicePromise = requestXRDevice(this.global, this.config);

    // Create `navigator.xr` instance populated with the XRDevice promise
    // requested above. The promise resolve will be monitored by the XR object.
    this.xr = new XR(devicePromise);
    Object.defineProperty(this.global.navigator, 'xr', {
      value: this.xr,
      configurable: true,
    });
  }
}
