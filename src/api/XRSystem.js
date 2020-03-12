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
import { XRReferenceSpaceTypes } from './XRReferenceSpace';

export const PRIVATE = Symbol('@@webxr-polyfill/XR');

export const XRSessionModes = ['inline', 'immersive-vr', 'immersive-ar'];

const DEFAULT_SESSION_OPTIONS = {
  'inline': {
    requiredFeatures: ['viewer'],
    optionalFeatures: [],
  },
  'immersive-vr': {
    requiredFeatures: ['viewer', 'local'],
    optionalFeatures: [],
  },
  'immersive-ar': {
    requiredFeatures: ['viewer', 'local'],
    optionalFeatures: [],
  }
};

const POLYFILL_REQUEST_SESSION_ERROR = 
`Polyfill Error: Must call navigator.xr.isSessionSupported() with any XRSessionMode
or navigator.xr.requestSession('inline') prior to requesting an immersive
session. This is a limitation specific to the WebXR Polyfill and does not apply
to native implementations of the API.`

export default class XRSystem extends EventTarget {
  /**
   * Receives a promise of an XRDevice, so that the polyfill
   * can pass in some initial checks to asynchronously provide XRDevices
   * if content immediately requests `requestDevice()`.
   *
   * @param {Promise<XRDevice>} devicePromise
   */
  constructor(devicePromise) {
    super();
    this[PRIVATE] = {
      device: null,
      devicePromise,
      immersiveSession: null,
      inlineSessions: new Set(),
    };

    devicePromise.then((device) => { this[PRIVATE].device = device; });
  }

  /**
   * @param {XRSessionMode} mode
   * @return {Promise<boolean>}
   */
  async isSessionSupported(mode) {
    // Always ensure that we wait for the device promise to resolve.
    if (!this[PRIVATE].device) {
      await this[PRIVATE].devicePromise;
    }

    // 'inline' is always guaranteed to be supported.
    if (mode != 'inline') {
      return Promise.resolve(this[PRIVATE].device.isSessionSupported(mode));
    } 

    return Promise.resolve(true);
  }

  /**
   * @param {XRSessionMode} mode
   * @param {XRSessionInit} options
   * @return {Promise<XRSession>}
   */
  async requestSession(mode, options) {
    // If the device hasn't resolved yet, wait for it and try again.
    if (!this[PRIVATE].device) {
      if (mode != 'inline') {
        // Because requesting immersive modes requires a user gesture, we can't
        // wait for a promise to resolve before making the real session request.
        // For that reason, we'll throw a polyfill-specific error here.
        throw new Error(POLYFILL_REQUEST_SESSION_ERROR);
      } else {
        await this[PRIVATE].devicePromise;
      }
    }

    if (!XRSessionModes.includes(mode)) {
      throw new TypeError(
          `The provided value '${mode}' is not a valid enum value of type XRSessionMode`);
    }

    // Resolve which of the requested features are supported and reject if a
    // required feature isn't available.
    const defaultOptions = DEFAULT_SESSION_OPTIONS[mode];
    const requiredFeatures = defaultOptions.requiredFeatures.concat(
        options && options.requiredFeatures ? options.requiredFeatures : []);
    const optionalFeatures = defaultOptions.optionalFeatures.concat(
        options && options.optionalFeatures ? options.optionalFeatures : []);
    const enabledFeatures = new Set();

    let requirementsFailed = false;
    for (let feature of requiredFeatures) {
      if (!this[PRIVATE].device.isFeatureSupported(feature)) {
        console.error(`The required feature '${feature}' is not supported`);
        requirementsFailed = true;
      } else {
        enabledFeatures.add(feature);
      }
    }

    if (requirementsFailed) {
      throw new DOMException('Session does not support some required features', 'NotSupportedError');
    }

    for (let feature of optionalFeatures) {
      if (!this[PRIVATE].device.isFeatureSupported(feature)) {
        console.log(`The optional feature '${feature}' is not supported`);
      } else {
        enabledFeatures.add(feature);
      }
    }

    // Call device's requestSession, which does some initialization (1.1 
    // fallback calls `vrDisplay.requestPresent()` for example). Could throw 
    // due to missing user gesture.
    const sessionId = await this[PRIVATE].device.requestSession(mode, enabledFeatures);
    const session = new XRSession(this[PRIVATE].device, mode, sessionId);

    if (mode == 'inline') {
      this[PRIVATE].inlineSessions.add(session);
    } else {
      this[PRIVATE].immersiveSession = session;
    }

    const onSessionEnd = () => {
      if (mode == 'inline') {
        this[PRIVATE].inlineSessions.delete(session);
      } else {
        this[PRIVATE].immersiveSession = null;
      }
      session.removeEventListener('end', onSessionEnd);
    };
    session.addEventListener('end', onSessionEnd);

    return session;
  }
}
