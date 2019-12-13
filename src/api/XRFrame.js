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

import {PRIVATE as SESSION_PRIVATE} from './XRSession';
import XRViewerPose from './XRViewerPose';
import XRView from './XRView';

export const PRIVATE = Symbol('@@webxr-polyfill/XRFrame');

const NON_ACTIVE_MSG = "XRFrame access outside the callback that produced it is invalid.";
const NON_ANIMFRAME_MSG = "getViewerPose can only be called on XRFrame objects passed to XRSession.requestAnimationFrame callbacks.";

let NEXT_FRAME_ID = 0;

export default class XRFrame {
  /**
   * @param {XRDevice} device
   * @param {XRSession} session
   * @param {number} sessionId
   */
  constructor(device, session, sessionId) {
    this[PRIVATE] = {
      id: ++NEXT_FRAME_ID,
      active: false,
      animationFrame: false,
      device,
      session,
      sessionId
    };
  }

  /**
   * @return {XRSession} session
   */
  get session() { return this[PRIVATE].session; }

  /**
   * @param {XRReferenceSpace} referenceSpace
   * @return {XRViewerPose?}
   */
  getViewerPose(referenceSpace) {
    if (!this[PRIVATE].animationFrame) {
      throw new DOMException(NON_ANIMFRAME_MSG, 'InvalidStateError');
    }
    if (!this[PRIVATE].active) {
      throw new DOMException(NON_ACTIVE_MSG, 'InvalidStateError');
    }

    const device = this[PRIVATE].device;
    const session = this[PRIVATE].session;

    session[SESSION_PRIVATE].viewerSpace._ensurePoseUpdated(device, this[PRIVATE].id);
    referenceSpace._ensurePoseUpdated(device, this[PRIVATE].id);

    let viewerTransform = referenceSpace._getSpaceRelativeTransform(session[SESSION_PRIVATE].viewerSpace);

    const views = [];
    for (let viewSpace of session[SESSION_PRIVATE].viewSpaces) {
      viewSpace._ensurePoseUpdated(device, this[PRIVATE].id);
      let viewTransform = referenceSpace._getSpaceRelativeTransform(viewSpace);
      let view = new XRView(device, viewTransform, viewSpace.eye, this[PRIVATE].sessionId);
      views.push(view);
    }
    let viewerPose = new XRViewerPose(viewerTransform, views, false /* TODO: emulatedPosition */);

    return viewerPose;
  }

  /**
   * @param {XRSpace} space
   * @param {XRSpace} baseSpace
   * @return {XRPose?} pose
   */
  getPose(space, baseSpace) {
    if (!this[PRIVATE].active) {
      throw new DOMException(NON_ACTIVE_MSG, 'InvalidStateError');
    }

    const device = this[PRIVATE].device;
    if (space._specialType === "target-ray" || space._specialType === "grip") {
      // TODO: Stop special-casing input.
      return device.getInputPose(
        space._inputSource, baseSpace, space._specialType);
    } else {
      space._ensurePoseUpdated(device, this[PRIVATE].id);
      baseSpace._ensurePoseUpdated(device, this[PRIVATE].id);
      let transform = baseSpace._getSpaceRelativeTransform(space);
      if (!transform) { return null; }
      return new XRPose(transform, false /* TODO: emulatedPosition */);
    }

    return null;
  }
}
