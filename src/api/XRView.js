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
import XRRigidTransform from './XRRigidTransform';

const XREyes = ['left', 'right', 'none'];

export const PRIVATE = Symbol('@@webxr-polyfill/XRView');

export default class XRView {
  /**
   * @param {XRDevice} device
   * @param {XREye} eye
   * @param {number} sessionId
   * @param {number} viewIndex
   */
  constructor(device, transform, eye, sessionId, viewIndex) {
    if (!XREyes.includes(eye)) {
      throw new Error(`XREye must be one of: ${XREyes}`);
    }

    // Create a shared object that can be updated by other code
    // that can update XRViewport values to adhere to API.
    // Ugly but it works.
    const temp = Object.create(null);
    const viewport = new XRViewport(temp);

    this[PRIVATE] = {
      device,
      eye,
      viewport,
      temp,
      sessionId,
      transform,
      viewIndex,
    };
  }

  /**
   * @return {XREye}
   */
  get eye() { return this[PRIVATE].eye; }

  /**
   * @return {Float32Array}
   */
  get projectionMatrix() {
    return this[PRIVATE].device.getProjectionMatrix(this.eye, this[PRIVATE].viewIndex);
  }

  /**
   * @return {XRRigidTransform}
   */
  get transform() { return this[PRIVATE].transform; }

  /**
   * NON-STANDARD
   *
   * `getViewport` is now exposed via XRWebGLLayer instead of XRView.
   * XRWebGLLayer delegates all the actual work to this function.
   *
   * @param {XRWebGLLayer} layer
   * @return {XRViewport?}
   */
  _getViewport(layer) {
    if (this[PRIVATE].device.getViewport(this[PRIVATE].sessionId,
                                           this.eye,
                                           layer,
                                           this[PRIVATE].temp,
                                           this[PRIVATE].viewIndex)) {
      return this[PRIVATE].viewport;
    }
    return undefined;
  }
}
