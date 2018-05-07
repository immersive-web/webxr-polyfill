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

import XRInputPose from './XRInputPose';
import { mat4_identity, mat4_fromRotationTranslation, mat4_copy } from '../math';

const PRIVATE = Symbol('@@webxr-polyfill/XRInputSource');

const HEAD_CONTROLLER_RIGHT_OFFSET = new Float32Array([0.155, -0.465, -0.35]);
const HEAD_CONTROLLER_LEFT_OFFSET = new Float32Array([-0.155, -0.465, -0.35]);

export class XRInputSourceImpl {
  constructor(polyfill, primaryButtonIndex = 0) {
    this.polyfill = polyfill;
    this.gamepad = null;
    this.inputSource = new XRInputSource(this);
    this.lastPosition = new Float32Array(3);
    this.emulatedPosition = false;
    this.basePoseMatrix = mat4_identity(new Float32Array(16));
    this.inputPoses = new WeakMap(); // Map of XRCoordinateSystem:XRInputPose
    this.primaryButtonIndex = primaryButtonIndex;
    this.primaryActionPressed = false;
  }

  updateFromGamepad(gamepad) {
    this.gamepad = gamepad;
    this.inputSource[PRIVATE].handedness = gamepad.hand;

    if (gamepad.pose) {
      this.inputSource[PRIVATE].pointerOrigin = 'hand';
      this.emulatedPosition = !gamepad.pose.hasPosition;
    } else if (gamepad.hand === '') {
      this.inputSource[PRIVATE].pointerOrigin = 'head';
      this.emulatedPosition = false;
    }
  }

  updateBasePoseMatrix() {
    if (this.gamepad && this.gamepad.pose) {
      let pose = this.gamepad.pose;
      let position = pose.position;
      let orientation = pose.orientation;
      // On initialization, we might not have any values
      if (!position && !orientation) {
        return;
      }
      if (!position) {
        if (!pose.hasPosition) {
          // TODO: Should do an elbow model here.
          if (this.gamepad.hand == 'left') {
            position = HEAD_CONTROLLER_LEFT_OFFSET;
          } else {
            position = HEAD_CONTROLLER_RIGHT_OFFSET;
          }
        } else {
          position = this.lastPosition;
        }
      } else {
        // This is if we temporarily lose tracking, so the controller doesn't
        // snap back to the origin.
        this.lastPosition[0] = position[0];
        this.lastPosition[1] = position[1];
        this.lastPosition[2] = position[2];
      }
      mat4_fromRotationTranslation(this.basePoseMatrix, orientation, position);
    } else {
      mat4_copy(this.basePoseMatrix, this.polyfill.getBasePoseMatrix());
    }
    return this.basePoseMatrix;
  }

  getXRInputPose(coordinateSystem) {
    this.updateBasePoseMatrix();
    let inputPose = this.inputPoses.get(coordinateSystem);
    if (!inputPose) {
      inputPose = new XRInputPose(this, this.gamepad && this.gamepad.pose);
      this.inputPoses.set(coordinateSystem, inputPose);
    }
    // TODO: The pointer matrix should probably be tweaked a bit.
    coordinateSystem.transformBasePoseMatrix(inputPose.pointerMatrix, this.basePoseMatrix);
    if (inputPose.gripMatrix) {
      coordinateSystem.transformBasePoseMatrix(inputPose.gripMatrix, this.basePoseMatrix);
    }
    return inputPose;
  }
}

export class XRInputSource {
  /**
   * @param {XRHandedness} handedness
   * @param {XRPointerOrigin} pointerOrigin
   * @param {number} sessionId
   */
  constructor(impl) {
    this[PRIVATE] = {
      impl,
      handedness: '',
      pointerOrigin: 'head'
    };
  }

  /**
   * @return {XRHandedness}
   */
  get handedness() { return this[PRIVATE].handedness; }

  /**
   * @return {XRPointerOrigin}
   */
  get pointerOrigin() { return this[PRIVATE].pointerOrigin; }
}
