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

import raf from 'raf';
import EventTarget from '../../src/lib/EventTarget';
import now from '../../src/lib/now';
import {
  perspective,
  mat4_copy,
  mat4_invert,
  mat4_fromRotationTranslation,
  mat4_identity
} from '../../src/math';

const IPD = 0.062;
let displayId = 0;
export default class MockVRDisplay extends EventTarget {
  constructor(global, config = {}) {
    super();
    this.global = global;
    this.displayId = ++displayId;
    this.displayName = 'MockVRDisplay';
    this.depthNear = 0.1;
    this.depthFar = 1000.0;
    this.isPresenting = false;
    this.stageParameters = null;

    this.capabilities = Object.assign({
      hasPosition: false,
      hasOrientation: true,
      hasExternalDisplay: false,
      canPresent: true,
      maxLayers: 1,
    }, config);

    if (this.capabilities.hasPosition) {
      this.stageParameters = {
        sizeX: 5,
        sizeZ: 10,
        sittingToStandingTransform: new Float32Array([
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1
        ]),
      };
    }

    // Width/height for calculating mock matrices/viewport
    this._width = 1920;
    this._height = 1080;

    this._leftViewMatrix = new Float32Array(16);
    this._rightViewMatrix = new Float32Array(16);
    this._leftProjectionMatrix = new Float32Array(16);
    this._rightProjectionMatrix = new Float32Array(16);
    this._poseMatrix = new Float32Array(16);

    mat4_identity(this._leftViewMatrix);
    mat4_identity(this._rightViewMatrix);
    mat4_identity(this._poseMatrix);
  }

  getFrameData(data) {
    data.timestamp = now();

    // Update projection matrices
    perspective(this._leftProjectionMatrix, Math.PI / 8, this._width / this._height, this.depthNear, this.depthFar);
    perspective(this._rightProjectionMatrix, Math.PI / 8, this._width / this._height, this.depthNear, this.depthFar);

    mat4_copy(data.leftProjectionMatrix, this._leftProjectionMatrix);
    mat4_copy(data.rightProjectionMatrix, this._rightProjectionMatrix);
    mat4_copy(data.leftViewMatrix, this._leftViewMatrix);
    mat4_copy(data.rightViewMatrix, this._rightViewMatrix);
   
    if (this.capabilities.hasPosition) {
      data.pose.position[0] = this._poseMatrix[12];
      data.pose.position[1] = this._poseMatrix[13];
      data.pose.position[2] = this._poseMatrix[14];
    }

    // The tests don't animate orientation, so just use a default
    // quaternion for now.
    data.pose.orientation[0] = 0;
    data.pose.orientation[1] = 0;
    data.pose.orientation[2] = 0;
    data.pose.orientation[3] = 1;
  }

  /**
   * @param {string} eye
   * @return {VREyeParameters}
   */
  getEyeParameters(eye) {
    return {
      offset: new Float32Array([eye === 'left' ? (-IPD/2) : (IPD/2), 0, 0]),
      renderWidth: this._width / 2,
      renderHeight: this._height,
    };
  }

  /**
   * @param {Function} callback
   */
  requestAnimationFrame(callback) {
    if (this.capabilities.hasPosition) {
      // Tick up the Z position by 1 per frame
      this._poseMatrix[14] = this._poseMatrix[14] + 1;
    }

    // Copy the pose to view matrices, apply IPD difference, invert.
    mat4_copy(this._leftViewMatrix, this._poseMatrix);
    mat4_copy(this._rightViewMatrix, this._poseMatrix);
    this._leftViewMatrix[12] = -IPD/2;
    this._rightViewMatrix[12] = IPD/2;

    mat4_invert(this._leftViewMatrix, this._leftViewMatrix);
    mat4_invert(this._rightViewMatrix, this._rightViewMatrix);
    return raf(callback);
  }

  /**
   * @param {number} handle
   */
  cancelAnimationFrame(handle) {
    raf.cancel(handle);
  }

  async requestPresent(layers) {
    if (layers.length > this.capabilities.maxLayers) {
      throw new Error();
    }

    if (!this.capabilities.canPresent) {
      throw new Error();
    }

    const currentlyPresenting = this.isPresenting;
    this.isPresenting = true;
    if (!currentlyPresenting) {
      const e = new this.global.window.Event('vrdisplaypresentchange');
      this.global.window.dispatchEvent(e);
    }

    this._layers = layers;
  }

  async exitPresent() {
    const currentlyPresenting = this.isPresenting;
    this.isPresenting = false;
    if (currentlyPresenting) {
      const e = new this.global.window.Event('vrdisplaypresentchange');
      this.global.window.dispatchEvent(e);
    }
    this._layers = null;
  }

  submitFrame() {
    if (!this.isPresenting) {
      throw new Error();
    }
  }

  getLayers() {
    return this._layers;
  }
}
