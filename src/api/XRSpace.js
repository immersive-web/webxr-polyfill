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
import XRRigidTransform from './XRRigidTransform';
import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';

export const PRIVATE = Symbol('@@webxr-polyfill/XRSpace');

// Not exposed, for reference only
export const XRSpaceSpecialTypes = [
  "grip",
  "target-ray"
];

export default class XRSpace {
  /**
   * @param {string?} specialType
   * @param {XRInputSource?} inputSource 
   */
  constructor(specialType = null, inputSource = null) {
    this[PRIVATE] = {
      specialType,
      inputSource,
      // The transform for the space in the base space, along with it's inverse
      baseMatrix: null,
      inverseBaseMatrix: null,
      lastFrameId: -1
    };
  }

  /**
   * @return {string?}
   */
  get _specialType() {
    return this[PRIVATE].specialType;
  }

  /**
   * @return {XRInputSource?}
   */
  get _inputSource() {
    return this[PRIVATE].inputSource;
  }

  /**
   * NON-STANDARD
   * Trigger an update for this space's base pose if necessary
   * @param {XRDevice} device
   * @param {Number} frameId
   */
  _ensurePoseUpdated(device, frameId) {
    if (frameId == this[PRIVATE].lastFrameId) return;
    this[PRIVATE].lastFrameId = frameId;
    this._onPoseUpdate(device);
  }

  /**
   * NON-STANDARD
   * Called when this space's base pose needs to be updated
   * @param {XRDevice} device
   */
  _onPoseUpdate(device) {
    if (this[PRIVATE].specialType == 'viewer') {
      this._baseMatrix = device.getBasePoseMatrix();
    }
  }

  /**
   * NON-STANDARD
   * @param {Float32Array(16)} matrix
   */
  set _baseMatrix(matrix) {
    this[PRIVATE].baseMatrix = matrix;
    this[PRIVATE].inverseBaseMatrix = null;
  }

  /**
   * NON-STANDARD
   * @return {Float32Array(16)}
   */
  get _baseMatrix() {
    if (!this[PRIVATE].baseMatrix) {
      if (this[PRIVATE].inverseBaseMatrix) {
        this[PRIVATE].baseMatrix = new Float32Array(16);
        mat4.invert(this[PRIVATE].baseMatrix, this[PRIVATE].inverseBaseMatrix);
      }
    }
    return this[PRIVATE].baseMatrix;
  }

  /**
   * NON-STANDARD
   * @param {Float32Array(16)} matrix
   */
  set _inverseBaseMatrix(matrix) {
    this[PRIVATE].inverseBaseMatrix = matrix;
    this[PRIVATE].baseMatrix = null;
  }

  /**
   * NON-STANDARD
   * @return {Float32Array(16)}
   */
  get _inverseBaseMatrix() {
    if (!this[PRIVATE].inverseBaseMatrix) {
      if (this[PRIVATE].baseMatrix) {
        this[PRIVATE].inverseBaseMatrix = new Float32Array(16);
        mat4.invert(this[PRIVATE].inverseBaseMatrix, this[PRIVATE].baseMatrix);
      }
    }
    return this[PRIVATE].inverseBaseMatrix;
  }

  /**
   * NON-STANDARD
   * Gets the transform of the given space in this space
   *
   * @param {XRSpace} space
   * @return {XRRigidTransform}
   */
  _getSpaceRelativeTransform(space) {
    if (!this._inverseBaseMatrix || !space._baseMatrix) {
      return null;
    }
    let out = new Float32Array(16);
    mat4.multiply(out, this._inverseBaseMatrix, space._baseMatrix);
    return new XRRigidTransform(out);
  }
}
