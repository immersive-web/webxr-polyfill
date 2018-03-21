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

import mocha from 'mocha';
import { assert } from 'chai';

import XRDevice from '../../src/api/XRDevice';
import XRSession from '../../src/api/XRSession';
import XRDevicePose from '../../src/api/XRDevicePose';
import XRPresentationContext from '../../src/api/XRPresentationContext';
import { mat4_identity } from '../../src/math';
import WebVRDevice from '../../src/devices/WebVRDevice';
import MockVRDisplay from '../lib/MockVRDisplay';
import { MockGlobalVR } from '../lib/globals';

const EPSILON = 0.0001;

describe('API - XRLayer', () => {
  describe('XRLayer#getViewport()', () => {
    it('returns XRViewport with appropriate x, y, width, height values when exclusive');
    it('returns XRViewport with appropriate x, y, width, height values when non-exclusive');
  });
});
