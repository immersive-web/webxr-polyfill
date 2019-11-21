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

import XRSpace from './XRSpace';
import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';

const DEFAULT_EMULATION_HEIGHT = 1.6;

export const PRIVATE = Symbol('@@webxr-polyfill/XRReferenceSpace');

export const XRReferenceSpaceTypes = [
  'viewer',
  'local',
  'local-floor',
  'bounded-floor',
  'unbounded' // TODO: 'unbounded' is not supported by the polyfill.
];

/**
 * @param {string} type 
 * @return {boolean}
 */
function isFloor(type) {
  return type === 'bounded-floor' || type === 'local-floor';
}

export default class XRReferenceSpace extends XRSpace {
  /**
   * Optionally takes a `transform` from a device's requestFrameOfReferenceMatrix
   * so device's can provide their own transforms for stage (or if they
   * wanted to override eye-level/head-model).
   *
   * @param {XRReferenceSpaceType} type
   * @param {Float32Array?} transform
   */
  constructor(type, transform = null) {
    if (!XRReferenceSpaceTypes.includes(type)) {
      throw new Error(`XRReferenceSpaceType must be one of ${XRReferenceSpaceTypes}`);
    }

    super(type);

    // If stage emulation is disabled, and this is a stage frame of reference,
    // and the XRDevice did not provide a transform, this is an invalid
    // configuration and we shouldn't emulate here. XRSession.requestFrameOfReference
    // should check this as well.
    if (type === 'bounded-floor' && !transform) {
      throw new Error(`XRReferenceSpace cannot use 'bounded-floor' type if the platform does not provide the floor level`);
    }

    // If we're using floor-level reference and no transform, we're emulating.
    // Set emulated height from option or use the default
    if (isFloor(type) && !transform) {
      // Apply an emulated height to the `y` translation
      transform = mat4.identity(new Float32Array(16));
      transform[13] = DEFAULT_EMULATION_HEIGHT;
    }

    this._inverseBaseMatrix = transform || mat4.identity(new Float32Array(16));

    this[PRIVATE] = {
      type,
      originOffset : mat4.identity(new Float32Array(16)),
    };
  }

  /**
   * NON-STANDARD
   * Called when this space's base pose needs to be updated
   * @param {XRDevice} device
   */
  _onPoseUpdate(device) {
    switch(this[PRIVATE].type) {
      case 'viewer': 
        this._baseMatrix = device.getBasePoseMatrix();
        break;
      default:
        break;
    }
  }

  /**
   * NON-STANDARD
   * Takes a base pose model matrix and transforms it by the
   * frame of reference.
   *
   * @param {Float32Array} out
   * @param {Float32Array} pose
   */
  _transformBasePoseMatrix(out, pose) {
    mat4.multiply(out, this._inverseBaseMatrix, pose);
  }

  /**
   * NON-STANDARD
   * 
   * @return {Float32Array}
   */
  _originOffsetMatrix() {
    return this[PRIVATE].originOffset;
  }

  /**
   * transformMatrix = Inv(OriginOffsetMatrix) * transformMatrix
   * @param {Float32Array} transformMatrix 
   */
  _adjustForOriginOffset(transformMatrix) {
    let inverseOriginOffsetMatrix = new Float32Array(16);
    mat4.invert(inverseOriginOffsetMatrix, this[PRIVATE].originOffset);
    mat4.multiply(transformMatrix, inverseOriginOffsetMatrix, transformMatrix);
  }

  /**
   * Gets the transform of the given space in this space
   *
   * @param {XRSpace} space
   * @return {XRRigidTransform}
   */
  _getSpaceRelativeTransform(space) {
    let transform = super._getSpaceRelativeTransform(space);
    // TODO: Optimize away double creation of XRRigidTransform
    this._adjustForOriginOffset(transform.matrix)
    return new XRRigidTransform(transform.matrix);
  }

  /**
   * Doesn't update the bound geometry for bounded reference spaces.
   * @param {XRRigidTransform} additionalOffset
   * @return {XRReferenceSpace}
  */
  getOffsetReferenceSpace(additionalOffset) {
    let newSpace = new XRReferenceSpace(
      this[PRIVATE].type,
      this[PRIVATE].transform,
      this[PRIVATE].bounds);

    mat4.multiply(newSpace[PRIVATE].originOffset, this[PRIVATE].originOffset, additionalOffset.matrix);
    return newSpace;
  }
}
