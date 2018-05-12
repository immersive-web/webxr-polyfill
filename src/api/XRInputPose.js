/*
 * Copyright 2018 Google Inc. All Rights Reserved.
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

import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';

const PRIVATE = Symbol('@@webxr-polyfill/XRInputPose');

export default class XRInputPose {
  /**
   * @param {boolean} emulatedPosition
   * @param {Float32Array} pointerMatrix
   * @param {Float32Array} gripMatrix
   */
  constructor(inputSourceImpl, hasGripMatrix) {
    this[PRIVATE] = {
      inputSourceImpl,
      pointerMatrix: mat4.identity(new Float32Array(16)),
      gripMatrix: hasGripMatrix ? mat4.identity(new Float32Array(16)) : null,
    };
  }

  /**
   * @return {boolean}
   */
  get emulatedPosition() { return this[PRIVATE].inputSourceImpl.emulatedPosition; }

  /**
   * @return {Float32Array}
   */
  get pointerMatrix() { return this[PRIVATE].pointerMatrix; }

  /**
   * @return {Float32Array}
   */
  get gripMatrix() { return this[PRIVATE].gripMatrix; }
}
