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

import XRDevicePose from './XRDevicePose';
import XRView from './XRView';

const PRIVATE = Symbol('@@webxr-polyfill/XRPresentationFrame');

export default class XRPresentationFrame {
  /**
   * @param {PolyfilledXRDevice} polyfill
   * @param {XRSession} session
   * @param {number} sessionId
   */
  constructor(polyfill, session, sessionId) {
    const devicePose = new XRDevicePose(polyfill);

    // Non-exclusive sessions only have a monoscopic view.
    const views = [
      new XRView(polyfill, 'left', sessionId),
    ];

    if (session.exclusive) {
      views.push(new XRView(polyfill, 'right', sessionId));
    }

    this[PRIVATE] = {
      polyfill,
      devicePose,
      views,
      session,
    };
  }

  /**
   * @TODO Not in spec, but used in sample code?
   *
   * @return {XRSession} session
   */
  get session() { return this[PRIVATE].session; }

  /**
   * @return {Array<XRView>} views
   */
  get views() { return this[PRIVATE].views; }

  /**
   * @param {XRCoordinateSystem} coordinateSystem
   * @return {XRDevicePose?}
   */
  getDevicePose(coordinateSystem) {
    this[PRIVATE].devicePose.updateFromFrameOfReference(coordinateSystem);
    return this[PRIVATE].devicePose;
  }
}
