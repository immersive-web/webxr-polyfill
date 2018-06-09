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

import XRInputPose from '../api/XRInputPose';
import XRInputSource from '../api/XRInputSource';
import OrientationArmModel from '../lib/OrientationArmModel';
import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';
import * as vec3 from 'gl-matrix/src/gl-matrix/vec3';
import { poseMatrixToXRRay } from '../utils';

export default class GamepadXRInputSource {
  constructor(polyfill, primaryButtonIndex = 0) {
    this.polyfill = polyfill;
    this.gamepad = null;
    this.inputSource = new XRInputSource(this);
    this.lastPosition = vec3.create();
    this.emulatedPosition = false;
    this.basePoseMatrix = mat4.create();
    this.inputPoses = new WeakMap(); // Map of XRCoordinateSystem:XRInputPose
    this.primaryButtonIndex = primaryButtonIndex;
    this.primaryActionPressed = false;
    this.handedness = '';
    this.targetRayMode = 'gaze';
    this.armModel = null;
  }

  updateFromGamepad(gamepad) {
    this.gamepad = gamepad;
    this.handedness = gamepad.hand;

    if (gamepad.pose) {
      this.targetRayMode = 'tracked-pointer';
      this.emulatedPosition = !gamepad.pose.hasPosition;
    } else if (gamepad.hand === '') {
      this.targetRayMode = 'gaze';
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
          if (!this.armModel) {
            this.armModel = new OrientationArmModel();
          }

          this.armModel.setHandedness(this.gamepad.hand);
          this.armModel.update(orientation, this.polyfill.getBasePoseMatrix());
          position = this.armModel.getPosition();
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
      mat4.fromRotationTranslation(this.basePoseMatrix, orientation, position);
    } else {
      mat4.copy(this.basePoseMatrix, this.polyfill.getBasePoseMatrix());
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

    const rayTransformMatrix = new Float32Array(16);
    // TODO: The pointer matrix should probably be tweaked a bit.
    coordinateSystem.transformBasePoseMatrix(rayTransformMatrix, this.basePoseMatrix);

    inputPose.targetRay = poseMatrixToXRRay(rayTransformMatrix);

    if (inputPose.gripMatrix) {
      coordinateSystem.transformBasePoseMatrix(inputPose.gripMatrix, this.basePoseMatrix);
    }
    return inputPose;
  }
}
