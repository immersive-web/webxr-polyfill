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

import XRViewerPose from './XRViewerPose';
import XRView from './XRView';
import { mat4 } from 'gl-matrix';

export const PRIVATE = Symbol('@@webxr-polyfill/XRFrame');

export default class XRFrame {
  /**
   * @param {XRDevice} device
   * @param {XRSession} session
   * @param {number} sessionId
   */
  constructor(device, session, sessionId) {
    // Non-immersive sessions only have a monoscopic view.
    const views = [
      new XRView(device, 'left', sessionId),
    ];

    if (session.immersive) {
      views.push(new XRView(device, 'right', sessionId));
    }

    this[PRIVATE] = {
      device,
      viewerPose: new XRViewerPose(device, views),
      views,
      session,
    };
  }

  /**
   * @return {XRSession} session
   */
  get session() { return this[PRIVATE].session; }

  /**
   * @param {XRSpace} space
   * @return {XRViewerPose?}
   */
  getViewerPose(space) {
    this[PRIVATE].viewerPose._updateFromReferenceSpace(space);
    return this[PRIVATE].viewerPose;
  }

  /**
   * @param {XRSpace} space
   * @param {XRSpace} baseSpace
   * @return {XRPose?} pose
   */
  getPose(space, baseSpace) {
    if (space._specialType === "viewer") {
      // Don't just return the viewer pose since the resulting pose shouldn't
      // include the views array - it should just have the transform.
      let viewerPose = this.getViewerPose(baseSpace);
      return new XRPose(
        new XRRigidTransform(viewerPose.poseModelMatrix),
        viewerPose.emulatedPosition);
    }

    if (space._specialType === "target-ray" || space._specialType === "grip") {
      return this[PRIVATE].device.getInputPose(
        space._inputSource, baseSpace, space._specialType);
    }

    return null;
  }
}
