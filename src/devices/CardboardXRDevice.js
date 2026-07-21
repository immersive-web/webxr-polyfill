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

import CardboardVRDisplay from 'cardboard-vr-display';
import WebVRDevice from './WebVRDevice';

export default class CardboardXRDevice extends WebVRDevice {
  /**
   * Takes a VRDisplay instance and a VRFrameData
   * constructor from the WebVR 1.1 spec.
   *
   * @param {VRDisplay} display
   * @param {Object?} cardboardConfig
   */
  constructor(global, cardboardConfig) {
    const display = new CardboardVRDisplay(cardboardConfig || {});
    super(global, display);

    this.display = display;
    this.frame = {
      rightViewMatrix: new Float32Array(16),
      leftViewMatrix: new Float32Array(16),
      rightProjectionMatrix: new Float32Array(16),
      leftProjectionMatrix: new Float32Array(16),
      pose: null,
      timestamp: null,
    };
  }
}
