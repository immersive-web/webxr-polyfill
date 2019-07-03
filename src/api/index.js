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

import XR from './XR';
import XRSession from './XRSession';
import XRFrame from './XRFrame';
import XRView from './XRView';
import XRViewport from './XRViewport';
import XRViewerPose from './XRViewerPose';
import XRInputPose from './XRInputPose';
import XRInputSource from './XRInputSource';
import XRLayer from './XRLayer';
import XRWebGLLayer from './XRWebGLLayer';
import XRPresentationContext from './XRPresentationContext';
import XRCoordinateSystem from './XRCoordinateSystem';
import XRFrameOfReference from './XRFrameOfReference';
import XRStageBounds from './XRStageBounds';
import XRStageBoundsPoint from './XRStageBoundsPoint';
import XRRay from './XRRay';

/**
 * Everything exposed here will also be attached to the window
 */
export default {
  XR,
  XRSession,
  XRFrame,
  XRView,
  XRViewport,
  XRViewerPose,
  XRLayer,
  XRWebGLLayer,
  XRPresentationContext,
  XRCoordinateSystem,
  XRFrameOfReference,
  XRStageBounds,
  XRStageBoundsPoint,
  XRInputPose,
  XRInputSource,
  XRRay,
};
