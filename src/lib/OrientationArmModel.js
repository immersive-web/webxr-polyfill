/*
 * Copyright 2016 Google Inc. All Rights Reserved.
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

import now from './now';
import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';
import * as vec3 from 'gl-matrix/src/gl-matrix/vec3';
import * as quat from 'gl-matrix/src/gl-matrix/quat';

const HEAD_ELBOW_OFFSET_RIGHTHANDED = vec3.fromValues(0.155, -0.465, -0.15);
const HEAD_ELBOW_OFFSET_LEFTHANDED = vec3.fromValues(-0.155, -0.465, -0.15);
const ELBOW_WRIST_OFFSET = vec3.fromValues(0, 0, -0.25);
const WRIST_CONTROLLER_OFFSET = vec3.fromValues(0, 0, 0.05);
const ARM_EXTENSION_OFFSET = vec3.fromValues(-0.08, 0.14, 0.08);

const ELBOW_BEND_RATIO = 0.4; // 40% elbow, 60% wrist.
const EXTENSION_RATIO_WEIGHT = 0.4;

const MIN_ANGULAR_SPEED = 0.61; // 35 degrees per second (in radians).
const MIN_ANGLE_DELTA = 0.175; // 10 degrees (in radians).

const MIN_EXTENSION_COS = 0.12; // cos of 83 degrees.
const MAX_EXTENSION_COS = 0.87; // cos of 30 degrees.

const RAD_TO_DEG = 180 / Math.PI;

function eulerFromQuaternion(out, q, order) {
  function clamp(value, min, max) {
    return (value < min ? min : (value > max ? max : value));
  }
  // Borrowed from Three.JS :)
  // q is assumed to be normalized
  // http://www.mathworks.com/matlabcentral/fileexchange/20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/content/SpinCalc.m
  var sqx = q[0] * q[0];
  var sqy = q[1] * q[1];
  var sqz = q[2] * q[2];
  var sqw = q[3] * q[3];

  if ( order === 'XYZ' ) {
    out[0] = Math.atan2( 2 * ( q[0] * q[3] - q[1] * q[2] ), ( sqw - sqx - sqy + sqz ) );
    out[1] = Math.asin(  clamp( 2 * ( q[0] * q[2] + q[1] * q[3] ), -1, 1 ) );
    out[2] = Math.atan2( 2 * ( q[2] * q[3] - q[0] * q[1] ), ( sqw + sqx - sqy - sqz ) );
  } else if ( order ===  'YXZ' ) {
    out[0] = Math.asin(  clamp( 2 * ( q[0] * q[3] - q[1] * q[2] ), -1, 1 ) );
    out[1] = Math.atan2( 2 * ( q[0] * q[2] + q[1] * q[3] ), ( sqw - sqx - sqy + sqz ) );
    out[2] = Math.atan2( 2 * ( q[0] * q[1] + q[2] * q[3] ), ( sqw - sqx + sqy - sqz ) );
  } else if ( order === 'ZXY' ) {
    out[0] = Math.asin(  clamp( 2 * ( q[0] * q[3] + q[1] * q[2] ), -1, 1 ) );
    out[1] = Math.atan2( 2 * ( q[1] * q[3] - q[2] * q[0] ), ( sqw - sqx - sqy + sqz ) );
    out[2] = Math.atan2( 2 * ( q[2] * q[3] - q[0] * q[1] ), ( sqw - sqx + sqy - sqz ) );
  } else if ( order === 'ZYX' ) {
    out[0] = Math.atan2( 2 * ( q[0] * q[3] + q[2] * q[1] ), ( sqw - sqx - sqy + sqz ) );
    out[1] = Math.asin(  clamp( 2 * ( q[1] * q[3] - q[0] * q[2] ), -1, 1 ) );
    out[2] = Math.atan2( 2 * ( q[0] * q[1] + q[2] * q[3] ), ( sqw + sqx - sqy - sqz ) );
  } else if ( order === 'YZX' ) {
    out[0] = Math.atan2( 2 * ( q[0] * q[3] - q[2] * q[1] ), ( sqw - sqx + sqy - sqz ) );
    out[1] = Math.atan2( 2 * ( q[1] * q[3] - q[0] * q[2] ), ( sqw + sqx - sqy - sqz ) );
    out[2] = Math.asin(  clamp( 2 * ( q[0] * q[1] + q[2] * q[3] ), -1, 1 ) );
  } else if ( order === 'XZY' ) {
    out[0] = Math.atan2( 2 * ( q[0] * q[3] + q[1] * q[2] ), ( sqw - sqx + sqy - sqz ) );
    out[1] = Math.atan2( 2 * ( q[0] * q[2] + q[1] * q[3] ), ( sqw + sqx - sqy - sqz ) );
    out[2] = Math.asin(  clamp( 2 * ( q[2] * q[3] - q[0] * q[1] ), -1, 1 ) );
  } else {
    console.log('No order given for quaternion to euler conversion.');
    return;
  }
}

/**
 * Represents the arm model for the Daydream controller. Feed it a camera and
 * the controller. Update it on a RAF.
 *
 * Get the model's pose using getPose().
 */
export default class OrientationArmModel {
  constructor() {
    this.hand = 'right';
    this.headElbowOffset = HEAD_ELBOW_OFFSET_RIGHTHANDED;

    // Current and previous controller orientations.
    this.controllerQ = quat.create();
    this.lastControllerQ = quat.create();

    // Current and previous head orientations.
    this.headQ = quat.create();

    // Current head position.
    this.headPos = vec3.create();

    // Positions of other joints (mostly for debugging).
    this.elbowPos = vec3.create();
    this.wristPos = vec3.create();

    // Current and previous times the model was updated.
    this.time = null;
    this.lastTime = null;

    // Root rotation.
    this.rootQ = quat.create();

    // Current position that this arm model calculates.
    this.position = vec3.create();
  }

  setHandedness(hand) {
    if (this.hand != hand) {
      this.hand = hand;
      if (this.hand == 'left') {
        this.headElbowOffset = HEAD_ELBOW_OFFSET_LEFTHANDED;
      } else {
        this.headElbowOffset = HEAD_ELBOW_OFFSET_RIGHTHANDED;
      }
    }
  }

  /**
   * Called on a RAF.
   */
  update(controllerOrientation, headPoseMatrix) {
    this.time = now();

    // Update the internal copies of the controller and head pose.
    if (controllerOrientation) {
      quat.copy(this.lastControllerQ, this.controllerQ);
      quat.copy(this.controllerQ, controllerOrientation);
    }

    if (headPoseMatrix) {
      mat4.getTranslation(this.headPos, headPoseMatrix);
      mat4.getRotation(this.headQ, headPoseMatrix);
    }

    // If the controller's angular velocity is above a certain amount, we can
    // assume torso rotation and move the elbow joint relative to the
    // camera orientation.
    let headYawQ = this.getHeadYawOrientation_();
    let angleDelta = this.quatAngle_(this.lastControllerQ, this.controllerQ);
    let timeDelta = (this.time - this.lastTime) / 1000;
    let controllerAngularSpeed = angleDelta / timeDelta;
    if (controllerAngularSpeed > MIN_ANGULAR_SPEED) {
      // Attenuate the Root rotation slightly.
      quat.slerp(this.rootQ, this.rootQ, headYawQ,
                 Math.min(angleDelta / MIN_ANGLE_DELTA, 1.0));
    } else {
      quat.copy(this.rootQ, headYawQ);
    }

    // We want to move the elbow up and to the center as the user points the
    // controller upwards, so that they can easily see the controller and its
    // tool tips.
    let controllerForward = vec3.fromValues(0, 0, -1.0);
    vec3.transformQuat(controllerForward, controllerForward, this.controllerQ);
    let controllerDotY = vec3.dot(controllerForward, [0, 1, 0]);
    let extensionRatio = this.clamp_(
        (controllerDotY - MIN_EXTENSION_COS) / MAX_EXTENSION_COS, 0.0, 1.0);

    // Controller orientation in camera space.
    let controllerCameraQ = quat.clone(this.rootQ);
    quat.invert(controllerCameraQ, controllerCameraQ);
    quat.multiply(controllerCameraQ, controllerCameraQ, this.controllerQ);


    // Calculate elbow position.
    let elbowPos = this.elbowPos;
    vec3.copy(elbowPos, this.headPos);
    vec3.add(elbowPos, elbowPos, this.headElbowOffset);
    let elbowOffset = vec3.clone(ARM_EXTENSION_OFFSET);
    vec3.scale(elbowOffset, elbowOffset, extensionRatio);
    vec3.add(elbowPos, elbowPos, elbowOffset);

    // Calculate joint angles. Generally 40% of rotation applied to elbow, 60%
    // to wrist, but if controller is raised higher, more rotation comes from
    // the wrist.
    let totalAngle = this.quatAngle_(controllerCameraQ, quat.create());
    let totalAngleDeg = totalAngle * RAD_TO_DEG;
    let lerpSuppression = 1 - Math.pow(totalAngleDeg / 180, 4);sssss

    let elbowRatio = ELBOW_BEND_RATIO;
    let wristRatio = 1 - ELBOW_BEND_RATIO;
    let lerpValue = lerpSuppression *
        (elbowRatio + wristRatio * extensionRatio * EXTENSION_RATIO_WEIGHT);

    let wristQ = quat.create();
    quat.slerp(wristQ, wristQ, controllerCameraQ, lerpValue);
    let invWristQ = quat.invert(quat.create(), wristQ);
    let elbowQ = quat.clone(controllerCameraQ);
    quat.multiply(elbowQ, elbowQ, invWristQ);

    // Calculate our final controller position based on all our joint rotations
    // and lengths.
    /*
    position_ =
      root_rot_ * (
        controller_root_offset_ +
2:      (arm_extension_ * amt_extension) +
1:      elbow_rot * (kControllerForearm + (wrist_rot * kControllerPosition))
      );
    */
    let wristPos = this.wristPos;
    vec3.copy(wristPos, WRIST_CONTROLLER_OFFSET);
    vec3.transformQuat(wristPos, wristPos, wristQ);
    vec3.add(wristPos, wristPos, ELBOW_WRIST_OFFSET);
    vec3.transformQuat(wristPos, wristPos, elbowQ);
    vec3.add(wristPos, wristPos, elbowPos);

    let offset = vec3.clone(ARM_EXTENSION_OFFSET);
    vec3.scale(offset, offset, extensionRatio);

    // Set the resulting pose orientation and position.
    vec3.add(this.position, this.wristPos, offset);
    vec3.transformQuat(this.position, this.position, this.rootQ);

    this.lastTime = this.time;
  }

  /**
   * Returns the position calculated by the model.
   */
  getPosition() {
    return this.position;
  }

  getHeadYawOrientation_() {
    let headEuler = vec3.create();
    eulerFromQuaternion(headEuler, this.headQ, 'YXZ');
    let destinationQ = quat.fromEuler(quat.create(), 0, headEuler[1] * RAD_TO_DEG, 0);
    return destinationQ;
  }

  clamp_(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  quatAngle_(q1, q2) {
    let vec1 = [0, 0, -1];
    let vec2 = [0, 0, -1];
    vec3.transformQuat(vec1, vec1, q1);
    vec3.transformQuat(vec2, vec2, q2);
    return vec3.angle(vec1, vec2);
  }
}