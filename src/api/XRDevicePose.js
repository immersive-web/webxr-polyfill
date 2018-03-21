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

const PRIVATE = Symbol('@@webxr-polyfill/XRDevicePose');
import { mat4_identity } from '../math';

export default class XRDevicePose {
  /**
   * @param {PolyfilledXRDevice} polyfill
   */
  constructor(polyfill) {
    this[PRIVATE] = {
      polyfill,
      leftViewMatrix: mat4_identity(new Float32Array(16)),
      rightViewMatrix: mat4_identity(new Float32Array(16)),
      poseModelMatrix: mat4_identity(new Float32Array(16)),
    };
  }

  /**
   * @return {Float32Array}
   */
  get poseModelMatrix() { return this[PRIVATE].poseModelMatrix; }

  /**
   * @param {XRView} view
   * @return Float32Array
   */
  getViewMatrix(view) {
    switch (view.eye) {
      case 'left': return this[PRIVATE].leftViewMatrix;
      case 'right': return this[PRIVATE].rightViewMatrix;
    }
    throw new Error(`view is not a valid XREye`);
  }

  /**
   * NON-STANDARD
   *
   * @param {XRFrameOfReference} frameOfRef
   */
  updateFromFrameOfReference(frameOfRef) {
    const pose = this[PRIVATE].polyfill.getBasePoseMatrix();
    const leftViewMatrix = this[PRIVATE].polyfill.getBaseViewMatrix('left');
    const rightViewMatrix = this[PRIVATE].polyfill.getBaseViewMatrix('right');

    if (pose) {
      frameOfRef.transformBasePoseMatrix(this[PRIVATE].poseModelMatrix, pose);
    }

    if (leftViewMatrix && rightViewMatrix) {
      frameOfRef.transformBaseViewMatrix(this[PRIVATE].leftViewMatrix,
                                         leftViewMatrix,
                                         this[PRIVATE].poseModelMatrix);
      frameOfRef.transformBaseViewMatrix(this[PRIVATE].rightViewMatrix,
                                         rightViewMatrix,
                                         this[PRIVATE].poseModelMatrix);
    }
  }
}
