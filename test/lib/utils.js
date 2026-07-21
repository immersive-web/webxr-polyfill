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

import XRDevice from '../../src/api/XRDevice';
import WebVRDevice from '../../src/devices/WebVRDevice';
import MockVRDisplay from './MockVRDisplay';
import { MockGlobalVR } from './globals';

/**
 * Creates an XRDevice backed by a WebVRDevice using a MockVRDisplay.
 * Pass in options that ultimately populate a VRDisplay's 1.1 capabilities,
 * like 'hasExternalDisplay'.
 */
export const createXRDevice = (config) => {
  const global = new MockGlobalVR();
  const polyfill = new WebVRDevice(global, new MockVRDisplay(global, config));
  return new XRDevice(polyfill);
};
