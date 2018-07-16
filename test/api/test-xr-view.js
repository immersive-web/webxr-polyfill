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

import { PRIVATE } from '../../src/api/XRView';
import XRDevice from '../../src/api/XRDevice';
import XRSession from '../../src/api/XRSession';
import XRDevicePose from '../../src/api/XRDevicePose';
import XRPresentationContext from '../../src/api/XRPresentationContext';
import WebVRDevice from '../../src/devices/WebVRDevice';
import MockVRDisplay from '../lib/MockVRDisplay';
import { MockGlobalVR } from '../lib/globals';

const EPSILON = 0.0001;

describe('API - XRView', () => {
  let global, polyfill, device, session, ref;
  // Technically this will expose the `frame` on a different than
  // requested tick, but as long as we're not asking for a new frame,
  // nothing should change in this mock env
  let getFrame = () => new Promise(r => session.requestAnimationFrame((t, frame) => r(frame)));
  beforeEach(async function () {
    global = new MockGlobalVR();
    polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    device = new XRDevice(polyfill);
    session = await device.requestSession({ immersive: true });
    ref = await session.requestFrameOfReference('eye-level');
  });

  it('exposes a PRIVATE named export', async function () {
    let frame = await getFrame();
    assert.ok(frame.views[0][PRIVATE]);
    assert.ok(frame.views[1][PRIVATE]);
  });

  it('has `eye` property of left and right', async function () {
    let frame = await getFrame();
    assert.equal(frame.views.length, 2);
    assert.ok(frame.views.some(v => v.eye === 'left'))
    assert.ok(frame.views.some(v => v.eye === 'right'))
  });

  it('has `projectionMatrix` based off of depthNear/depthFar', async function () {
    let expected = new Float32Array([
      2.8278, 0, 0, 0,
      0, 5.0273, 0, 0,
      0, 0, -1.0002, -1,
      0, 0, -0.2, 0
    ]);

    session.depthNear = 0.1;
    session.depthFar = 1000;
    let frame = await getFrame();
    let view = frame.views[0];
    for (let i = 0; i < expected.length; i++) {
      assert.closeTo(view.projectionMatrix[i], expected[i], EPSILON);
    }

    // Change depthNear to see if it propagates to the projectionMatrix
    session.depthNear = 0.01;
    session.depthFar = 1000;
    frame = await getFrame();
    view = frame.views[0];
    expected[10] = -1.00002;
    expected[14] = -0.02000;
    for (let i = 0; i < expected.length; i++) {
      assert.closeTo(view.projectionMatrix[i], expected[i], EPSILON);
    }
  });

  /**
   * TODO this function been moved to XRLayer, so we're
   * testing the underlying implementation here. We should test
   * the XRLayer directly, although that's a bit harder with the WebGLContext
   * usage in node.
   */
  describe('XRView#_getViewport()', () => {
    it('returns XRViewport with appropriate x, y, width, height values when immersive', async function () {
      const layer = { context: { canvas: { width: 1920, height: 1080 }}};

      let frame = await getFrame();
      assert.equal(frame.views.length, 2);
      for (let view of frame.views) {
        let viewport = view._getViewport(layer);
        assert.equal(viewport.x, view.eye === 'left' ? 0 : layer.context.canvas.width / 2);
        assert.equal(viewport.y, 0);
        assert.equal(viewport.width, layer.context.canvas.width / 2);
        assert.equal(viewport.height, layer.context.canvas.height);
      }
    });

    it('returns XRViewport with appropriate x, y, width, height values when non-immersive', async function () {
      const layer = { context: { canvas: { width: 1920, height: 1080 }}};
      session = await device.requestSession({ outputContext: new XRPresentationContext() });

      let frame = await getFrame();
      assert.equal(frame.views.length, 1);
      let viewport = frame.views[0]._getViewport(layer);
      assert.equal(viewport.x, 0);
      assert.equal(viewport.y, 0);
      assert.equal(viewport.width, 1920);
      assert.equal(viewport.height, 1080);
    });
  });
});
