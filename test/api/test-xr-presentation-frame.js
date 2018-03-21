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

import XRSession from '../../src/api/XRSession';
import XRDevicePose from '../../src/api/XRDevicePose';
import { createXRDevice } from '../lib/utils';

describe('API - XRPresentationFrame', () => {
  let device, session, ref;
  beforeEach(async function () {
    device = createXRDevice();
    session = await device.requestSession({ exclusive: true });
    ref = await session.requestFrameOfReference('eyeLevel');
  });

  it('has two views', done => {
    session.requestAnimationFrame((t, frame) => {
      assert.equal(frame.views.length, 2);
      const eyes = frame.views.map(v => v.eye);
      assert.include(eyes, 'left');
      assert.include(eyes, 'right');
      done();
    });
  });

  it('can get a device pose', done => {
    session.requestAnimationFrame((t, frame) => {
      const pose = frame.getDevicePose(ref);
      assert.instanceOf(pose, XRDevicePose);
      assert.instanceOf(pose.poseModelMatrix, Float32Array);
      done();
    });
  });
});
