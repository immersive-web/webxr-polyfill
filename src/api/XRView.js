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

import XRViewport from './XRViewport';

const PRIVATE = Symbol('@@webxr-polyfill/XRView');

const XREyes = ['left', 'right'];

export default class XRView {
  /**
   * @param {PolyfilledXRDevice} polyfill
   * @param {XREye} eye
   * @param {number} sessionId
   */
  constructor(polyfill, eye, sessionId) {
    if (!XREyes.includes(eye)) {
      throw new Error(`XREye must be one of: ${XREyes}`);
    }

    // Create a shared object that can be updated by other code
    // that can update XRViewport values to adhere to API.
    // Ugly but it works.
    const temp = Object.create(null);
    const viewport = new XRViewport(temp);

    this[PRIVATE] = {
      polyfill,
      eye,
      viewport,
      temp,
      sessionId,
    };
  }

  /**
   * @return {XREye}
   */
  get eye() { return this[PRIVATE].eye; }

  /**
   * @return {Float32Array}
   */
  get projectionMatrix() { return this[PRIVATE].polyfill.getProjectionMatrix(this.eye); }

  /**
   * NON-STANDARD
   *
   * Previously `getViewport` was on XRView, and after a spec change, it's now
   * available on a XRWebGLLayer. This may have to handle different types of
   * layers in the future, and the XRLayer.getViewport() function mostly directly
   * calls this function.
   *
   * https://github.com/immersive-web/webxr/pull/329/
   *
   * @param {XRLayer} layer
   * @return {XRViewport?}
   */
  _getViewport(layer) {
    const viewport = this[PRIVATE].viewport;
    if (this[PRIVATE].polyfill.getViewport(this[PRIVATE].sessionId,
                                           this.eye,
                                           layer,
                                           this[PRIVATE].temp)) {
      return this[PRIVATE].viewport;
    }
    return undefined;
  }
}
