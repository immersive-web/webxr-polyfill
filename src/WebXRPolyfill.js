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
  // The default global to use for needed APIs.
  global: GLOBAL,
  // Whether support for a browser implementing WebVR 1.1 is enabled.
  // If enabled, XR support is powered by native WebVR 1.1 VRDisplays,
  // exposed as XRDevices.
  webvr: true,
  
  webvrConfig: null,
  // Whether a CardboardXRDevice should be discoverable if on
  // a mobile device, and no other native (1.1 VRDisplay if `webvr` on,
  // or XRDevice) found.
  cardboard: true,
  // The configuration to be used for CardboardVRDisplay when used.
  // Has no effect if `cardboard: false` or another XRDevice is used.
  // Configuration can be found: https://github.com/immersive-web/cardboard-vr-display/blob/master/src/options.js
  cardboardConfig: null,
  // Whether a CardboardXRDevice should be created if no WebXR API found
  // on desktop or not. Stereoscopic rendering with a gyro often does not make sense on desktop, and probably only useful for debugging.
  allowCardboardOnDesktop: false,
};

const partials = ['navigator', 'HTMLCanvasElement', 'WebGLRenderingContext'];

export default class WebXRPolyfill {
  /**
   * @param {object?} config
   */
  constructor(config={}) {
    this.config = Object.freeze(Object.assign({}, CONFIG_DEFAULTS, config));
    this.global = this.config.global;
    this.nativeWebXR = 'xr' in this.global.navigator;
    this.injected = false;

    // If no native WebXR implementation found, inject one
    if (!this.nativeWebXR) {
      this._injectPolyfill(this.global);
    } else {
      this._injectCompatibilityShims(this.global);
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
      // parameter `{ xrCompatible }`.
      if (polyfilledCtx) {
        polyfillGetContext(global.HTMLCanvasElement);

        // If OffscreenCanvas is available, patch its `getContext` method as well
        // for the compatible XRDevice bit.
        if (global.OffscreenCanvas) {
          polyfillGetContext(global.OffscreenCanvas);
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
    this.xr = new API.XR(devicePromise);
    Object.defineProperty(this.global.navigator, 'xr', {
      value: this.xr,
      configurable: true,
    });
  }

  _injectCompatibilityShims(global) {
    if (!partials.every(iface => !!global[iface])) {
      throw new Error(`Global must have the following attributes : ${partials}`);
    }

    // Patch for Chrome 76-78: exposed supportsSession rather than
    // isSessionSupported. Wraps the function to ensure the promise properly
    // resolves with a boolean.
    if (global.navigator.xr &&
        'supportsSession' in global.navigator.xr &&
        !('isSessionSupported' in global.navigator.xr)) {
      let originalSupportsSession = global.navigator.xr.supportsSession;
      global.navigator.xr.isSessionSupported = function(mode) {
        return originalSupportsSession.call(this, mode).then(() => {
          return true;
        }).catch(() => {
          return false;
        });
      }

      global.navigator.xr.supportsSession = function(mode) {
        console.warn("navigator.xr.supportsSession() is deprecated. Please " +
        "call navigator.xr.isSessionSupported() instead and check the boolean " +
        "value returned when the promise resolves.");
        return originalSupportsSession.call(this, mode);
      }
    }
  }
}
