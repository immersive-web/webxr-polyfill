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

import XRDevice from './api/XRDevice';

import CardboardXRDevice from './devices/CardboardXRDevice';
import WebVRDevice from './devices/WebVRDevice';

import { isMobile } from './utils';

/**
 * Queries browser to see if any XRDevice exists.
 * Resolves to an XRDevice or null.
 */
const getXRDevice = async function (global) {
  let device = null;
  if ('xr' in global.navigator) {
    try {
      device = await global.navigator.xr.requestDevice();
    } catch (e) {}
  }

  return device;
};

/**
 * Queries browser to see if any VRDisplay exists.
 * Resolves to a polyfilled XRDevice or null.
 */
const getVRDisplay = async function (global) {
  let device = null;
  if ('getVRDisplays' in global.navigator) {
    try {
      const displays = await global.navigator.getVRDisplays();
      if (displays && displays.length) {
        device = new WebVRDevice(global, displays[0]);
      }
    } catch (e) {}
  }

  return device;
};

/**
 * Return polyfilled XRDevices based off of configuration
 * and platform.
 *
 * @param {Object} global
 * @param {Object} config
 * @return {Promise<XRDevice?>}
 */
export const requestDevice = async function (global, config) {
  // First, see if there are any native XRDevices on the platform
  // in the case where we're not polyfilling the API, but providing
  // a cardboard display if no native devices found.
  let device = await getXRDevice(global);

  if (device) {
    return device;
  }

  // If no native XR devices found, check for a 1.1 VRDisplay.
  if (config.webvr) {
    device = await getVRDisplay(global);
    if (device) {
      return new XRDevice(device);
    }
  }

  // If cardboard is enabled, there are no native 1.1 VRDisplays,
  // and we're on mobile, provide a CardboardXRDevice.
  if (config.cardboard && isMobile(global)) {
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

    return new XRDevice(new CardboardXRDevice(global));
  }

  return null;
}
