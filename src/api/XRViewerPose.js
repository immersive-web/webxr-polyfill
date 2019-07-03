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

import XRPose from './XRPose';
import XRRigidTransform from './XRRigidTransform';
import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';

export const PRIVATE = Symbol('@@webxr-polyfill/XRViewerPose');

export default class XRViewerPose extends XRPose {
  /**
   * @param {XRDevice} device
   */
  constructor(device, views) {
    super(new XRRigidTransform(), false);
    this[PRIVATE] = {
      device,
      views,
      leftViewMatrix: mat4.identity(new Float32Array(16)),
      rightViewMatrix: mat4.identity(new Float32Array(16)),
      poseModelMatrix: mat4.identity(new Float32Array(16)),
    };
  }

  /**
   * @return {Float32Array}
   */
  get poseModelMatrix() { return this[PRIVATE].poseModelMatrix; }

  /**
   * @return {Array<XRView>}
   */
  get views() {
    return this[PRIVATE].views;
  }

  /**
   * NON-STANDARD
   *
   * @param {XRReferenceSpace} refSpace
   */
  _updateFromReferenceSpace(refSpace) {
    const pose = this[PRIVATE].device.getBasePoseMatrix();
    const leftViewMatrix = this[PRIVATE].device.getBaseViewMatrix('left');
    const rightViewMatrix = this[PRIVATE].device.getBaseViewMatrix('right');

    if (pose) {
      refSpace._transformBasePoseMatrix(this[PRIVATE].poseModelMatrix, pose);
      refSpace._adjustForOriginOffset(this[PRIVATE].poseModelMatrix);

      // TODO: Because XRPose.transform is [SameObject], this XRViewerPose needs
      // to be re-created instead of updated in-place to be spec-compliant.
      super._setTransform(new XRRigidTransform(this[PRIVATE].poseModelMatrix));
    }

    // View matrices are the inverse of the view transform, so must do
    // matrix = matrix * originOffset
    // instead of
    // matrix = inv(originOffset) * matrix
    // (which is what is done for the other transforms).
    if (leftViewMatrix) {
      refSpace._transformBaseViewMatrix(
        this[PRIVATE].leftViewMatrix,
        leftViewMatrix,
        this[PRIVATE].poseModelMatrix);

      mat4.multiply(
        this[PRIVATE].leftViewMatrix,
        this[PRIVATE].leftViewMatrix,
        refSpace._originOffsetMatrix());
    }
    
    if (rightViewMatrix) {
      refSpace._transformBaseViewMatrix(
        this[PRIVATE].rightViewMatrix,
        rightViewMatrix,
        this[PRIVATE].poseModelMatrix);

      mat4.multiply(
        this[PRIVATE].rightViewMatrix,
        this[PRIVATE].rightViewMatrix,
        refSpace._originOffsetMatrix());
    }

    for (let view of this[PRIVATE].views) {
      if (view.eye == "left") {
        view._updateViewMatrix(this[PRIVATE].leftViewMatrix);
      } else if (view.eye == "right") {
        view._updateViewMatrix(this[PRIVATE].rightViewMatrix);
      }
    }
  }
}
