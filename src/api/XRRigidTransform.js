/*
 * Copyright 2019 Google Inc. All Rights Reserved.
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
import * as vec3 from 'gl-matrix/src/gl-matrix/vec3';
import * as quat from 'gl-matrix/src/gl-matrix/quat';

export const PRIVATE = Symbol('@@webxr-polyfill/XRRigidTransform');

export default class XRRigidTransform {
  // no arguments: identity transform
  // (Float32Array): transform based on matrix
  // (DOMPointReadOnly): transform based on position without any rotation
  // (DOMPointReadOnly, DOMPointReadOnly): transform based on position and
  // orientation quaternion
  constructor() {
    this[PRIVATE] = {
      matrix: null,
      position: null,
      orientation: null,
      inverse: null,
    };

    if (arguments.length === 0) {
      this[PRIVATE].matrix = mat4.identity(new Float32Array(16));
    } else if (arguments.length === 1) {
      if (arguments[0] instanceof Float32Array) {
        this[PRIVATE].matrix = arguments[0];
      } else {
        this[PRIVATE].position = this._getPoint(arguments[0]);
        this[PRIVATE].orientation = DOMPointReadOnly.fromPoint({
            x: 0, y: 0, z: 0, w: 1
        });
      }
    } else if (arguments.length === 2) {
      this[PRIVATE].position = this._getPoint(arguments[0]);
      this[PRIVATE].orientation = this._getPoint(arguments[1]);
    } else {
      throw new Error("Too many arguments!");
    }

    if (this[PRIVATE].matrix) {
        // Decompose matrix into position and orientation.
        let position = vec3.create();
        mat4.getTranslation(position, this[PRIVATE].matrix);
        this[PRIVATE].position = DOMPointReadOnly.fromPoint({
            x: position[0],
            y: position[1],
            z: position[2]
        });

        let orientation = quat.create();
        mat4.getRotation(orientation, this[PRIVATE].matrix);
        this[PRIVATE].orientation = DOMPointReadOnly.fromPoint({
          x: orientation[0],
          y: orientation[1],
          z: orientation[2],
          w: orientation[3]
        });
    } else {
        // Compose matrix from position and orientation.
        this[PRIVATE].matrix = mat4.identity(new Float32Array(16));
        mat4.fromRotationTranslation(
          this[PRIVATE].matrix,
          quat.fromValues(
            this[PRIVATE].orientation.x,
            this[PRIVATE].orientation.y,
            this[PRIVATE].orientation.z,
            this[PRIVATE].orientation.w),
          vec3.fromValues(
            this[PRIVATE].position.x,
            this[PRIVATE].position.y,
            this[PRIVATE].position.z)
        );
    }
  }

  /**
   * Try to convert arg to a DOMPointReadOnly if it isn't already one.
   * @param {*} arg
   * @return {DOMPointReadOnly}
   */
  _getPoint(arg) {
    if (arg instanceof DOMPointReadOnly) {
      return arg;
    }

    return DOMPointReadOnly.fromPoint(arg);
  }

  /**
   * @return {Float32Array}
   */
  get matrix() { return this[PRIVATE].matrix; }

  /**
   * @return {DOMPointReadOnly}
   */
  get position() { return this[PRIVATE].position; }

  /**
   * @return {DOMPointReadOnly}
   */
  get orientation() { return this[PRIVATE].orientation; }

  /**
   * @return {XRRigidTransform}
   */
  get inverse() {
    if (this[PRIVATE].inverse === null) {
      let invMatrix = mat4.identity(new Float32Array(16));
      mat4.invert(invMatrix, this[PRIVATE].matrix);
      this[PRIVATE].inverse = new XRRigidTransform(invMatrix);
      this[PRIVATE].inverse[PRIVATE].inverse = this;
    }

    return this[PRIVATE].inverse;
  }
}
