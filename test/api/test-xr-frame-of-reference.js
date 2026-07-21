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
import raf from 'raf';

import XRDevice from '../../src/api/XRDevice';
import XRSession from '../../src/api/XRSession';
import XRPresentationContext from '../../src/api/XRPresentationContext';
import XRFrameOfReference, { PRIVATE } from '../../src/api/XRFrameOfReference';
import XRStageBounds from '../../src/api/XRStageBounds';
import { createXRDevice } from '../lib/utils';
import WebVRDevice from '../../src/devices/WebVRDevice';
import MockVRDisplay from '../lib/MockVRDisplay';
import { MockGlobalVR } from '../lib/globals';
import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';

describe('API - XRFrameOfReference', () => {
  it('exposes a PRIVATE named export', async function () {
    const device = createXRDevice();
    const session = await device.requestSession({ immersive: true });
    const frameOfRef = await session.requestFrameOfReference('eye-level');
    assert.ok(frameOfRef[PRIVATE]);
  });

  it('uses the polyfill\'s transform if provided', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ immersive: true });

    polyfill.requestFrameOfReferenceTransform = async function (type, options) {
      assert.equal(type, 'head-model');
      return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 8, 0, 1
      ]);
    };

    const frameOfRef = await session.requestFrameOfReference('head-model');

    const pose = mat4.identity(new Float32Array(16));
    // Set position to <1, 1, 1>
    pose[12] = pose[13] = pose[14] = 1;
    const out = new Float32Array(16);
    frameOfRef.transformBasePoseMatrix(out, pose);

    assert.deepEqual(out, new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      1, 9, 1, 1
    ]), 'pose is transformed by custom frame of reference from polyfill');
  });

  it('rejects if stage not provided and emulation disabled', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ immersive: true });

    return new Promise((resolve, reject) =>
      session.requestFrameOfReference('stage', { disableStageEmulation: true })
        .then(reject, resolve));
  });

  it('rejects if the polyfill rejects the option', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ immersive: true });

    polyfill.requestFrameOfReferenceTransform = function (type, options) {
      return Promise.reject();
    };

    return new Promise((resolve, reject) => {
      session.requestFrameOfReference('head-model').then(reject, resolve);
    });
  });

  it('`emulatedHeight` is 0 when using non-stage reference', async function () {
    const device = createXRDevice();
    const session = await device.requestSession({ immersive: true });
    const ref = await session.requestFrameOfReference('head-model');
    assert.equal(ref.emulatedHeight, 0);
  });

  it('`emulatedHeight` is 0 when using non-emulated stage reference', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ immersive: true });
    polyfill.requestFrameOfReferenceTransform = function (type, options) {
      const out = new Float32Array()
      mat4.identity(out);
      return out;
    };

    let ref = await session.requestFrameOfReference('stage', { disableStageEmulation: true });
    assert.equal(ref.emulatedHeight, 0);

    // Allowing emulation shouldn't change this as the platform provides
    ref = await session.requestFrameOfReference('stage', { disableStageEmulation: false });
    assert.equal(ref.emulatedHeight, 0);
  });

  it('`emulatedHeight` is default value when using emulated stage when using 0 as `stageEmulationHeight`', async function () {
    const device = createXRDevice();
    const session = await device.requestSession({ immersive: true });
    const ref = await session.requestFrameOfReference('stage', { stageEmulationHeight: 0 });
    assert.equal(ref.emulatedHeight, 1.6);
  });

  it('`emulatedHeight` is default value when using emulated stage', async function () {
    const device = createXRDevice();
    const session = await device.requestSession({ immersive: true });
    const ref = await session.requestFrameOfReference('stage');
    assert.equal(ref.emulatedHeight, 1.6);
  });

  it('`emulatedHeight` uses `stageEmulationHeight` when emulated and non-zero', async function () {
    const device = createXRDevice();
    const session = await device.requestSession({ immersive: true });
    const ref = await session.requestFrameOfReference('stage', { stageEmulationHeight: 2.0 });
    assert.equal(ref.emulatedHeight, 2);
  });

  it('provides `bounds` when requesting a stage from a 6DOF device', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global, { hasPosition: true }));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ immersive: true });
    const ref = await session.requestFrameOfReference('stage');//, { stageEmulationHeight: 2.0 });
    assert.instanceOf(ref.bounds, XRStageBounds);
    assert.equal(ref.bounds.geometry[0].x, -2.5);
    assert.equal(ref.bounds.geometry[0].z, -5);
    assert.equal(ref.bounds.geometry[1].x, 2.5);
    assert.equal(ref.bounds.geometry[1].z, -5);
    assert.equal(ref.bounds.geometry[2].x, 2.5);
    assert.equal(ref.bounds.geometry[2].z, 5);
    assert.equal(ref.bounds.geometry[3].x, -2.5);
    assert.equal(ref.bounds.geometry[3].z, 5);
  });

  describe('XRFrameOfReference#transformBasePoseMatrix', () => {
    // Get pose with translation of <5, 6, 7>
    const getPose = () => new Float32Array([
      1,  0,  0, 0,
      0, -1,  0, 0,
      0,  0, -1, 0,
      5,  6,  7, 1
    ]);

    const data = [
      // head-model should strip out only translation
      ['head-model', [
        1,  0,  0, 0,
        0, -1,  0, 0,
        0,  0, -1, 0,
        0,  0,  0, 1
      ]],
      // eye-level shouldn't modify the pose at all
      ['eye-level', [
        1,  0,  0, 0,
        0, -1,  0, 0,
        0,  0, -1, 0,
        5,  6,  7, 1
      ]],
      // stage should increment the Y translation by the default
      // emulation height
      ['stage', [
        1,  0,    0, 0,
        0, -1,    0, 0,
        0,  0,   -1, 0,
        5,  7.6,  7, 1
      ]]
    ];

    data.forEach(([type, expected]) => {
      it(`uses the default transform for ${type} if none provided`, async function () {
        const device = createXRDevice();
        const session = await device.requestSession({ immersive: true });
        const frameOfRef = await session.requestFrameOfReference(type);
        const actual = mat4.identity(new Float32Array(16));
        frameOfRef.transformBasePoseMatrix(actual, getPose());
        assert.deepEqual(actual, new Float32Array(expected));
      });
    });

    it('uses stageEmulationHeight when provided when emulating stage', async function () {
      const device = createXRDevice();
      const session = await device.requestSession({ immersive: true });
      const frameOfRef = await session.requestFrameOfReference('stage', { stageEmulationHeight: 1.55 });
      const actual = mat4.identity(new Float32Array(16));
      frameOfRef.transformBasePoseMatrix(actual, getPose());
      assert.deepEqual(actual, new Float32Array([
        1,  0,    0, 0,
        0, -1,    0, 0,
        0,  0,   -1, 0,
        5,  7.55, 7, 1
      ]));
    });
  });

  describe('XRFrameOfReference#transformBaseViewMatrix', () => {
    it('correctly transforms view matrix when non-stage values provided');
    it('correctly transforms view matrix when stage values provided');
  });
});
