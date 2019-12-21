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

import CardboardXRDevice from './devices/CardboardXRDevice';
import InlineDevice from './devices/InlineDevice';
import WebVRDevice from './devices/WebVRDevice';

import { isMobile } from './utils';

/**
 * Queries browser to see if any VRDisplay exists.
 * Resolves to a polyfilled XRDevice or null.
 */
const getWebVRDevice = async function (global, webvrConfig) {
  let device = null;
  if ('getVRDisplays' in global.navigator) {
    try {
      const displays = await global.navigator.getVRDisplays();
      if (displays && displays.length) {
        device = new WebVRDevice(global, webvrConfig, displays[0]);
      }
    } catch (e) {}
  }

  return device;
};

/**
 * Return an XRDevice interface based off of configuration
 * and platform.
 *
 * @param {Object} global
 * @param {Object} config
 * @return {Promise<XRDevice?>}
 */
export const requestXRDevice = async function (global, config) {
  // Check for a 1.1 VRDisplay.
  if (config.webvr) {
    let xr = await getWebVRDevice(global, config.webvrConfig);
    if (xr) {
      return xr;
    }
  }

  // If no WebVR devices are present, check to see if a Cardboard device is
  // allowed and if so return that.
  // TODO: This probably requires more changes to allow creating an
  // immersive session in a headset that gets connected later.
  let mobile = isMobile(global);
  if ((mobile && config.cardboard) ||
      (!mobile && config.allowCardboardOnDesktop)) {
    // If we're on Cardboard, make sure that VRFrameData is a global
    if (!global.VRFrameData) {
      global.VRFrameData = function () {
        this.rightViewMatrix = new Float32Array(16);
        this.leftViewMatrix = new Float32Array(16);
        this.rightProjectionMatrix = new Float32Array(16);
        this.leftProjectionMatrix = new Float32Array(16);
        this.pose = null;
      };
    }

    return new CardboardXRDevice(global, config.cardboardConfig);
  }

  // Inline sessions are always allowed, so if no other device is available
  // create one that only supports sensorless inline sessions.
  return new InlineDevice(global);
}
