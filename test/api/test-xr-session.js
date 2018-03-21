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
import XRFrameOfReference from '../../src/api/XRFrameOfReference';
import { MockGlobalVR } from '../lib/globals';
import MockVRDisplay from '../lib/MockVRDisplay';
import WebVRDevice from '../../src/devices/WebVRDevice';
import { createXRDevice } from '../lib/utils';

describe('API - XRSession', () => {
  it('has `device` property of owner XRDevice', async function () {
    const device = createXRDevice();
    const session = await device.requestSession({ exclusive: true });
    assert.equal(session.device, device);
  });

  it('has `exclusive` property set to session options', async function () {
    let options = { exclusive: true, outputContext: new XRPresentationContext() };
    let device = createXRDevice();
    let session = await device.requestSession(options);
    assert.equal(session.exclusive, true);

    options.exclusive = false;
    device = createXRDevice();
    session = await device.requestSession(options);
    assert.equal(session.exclusive, false);
  });

  it('has `outputContext` property set to session options', async function () {
    let options = { exclusive: true, outputContext: new XRPresentationContext() };
    let device = createXRDevice();
    let session = await device.requestSession(options);
    assert.equal(session.outputContext, options.outputContext);

    options.outputContext = undefined;
    device = createXRDevice();
    session = await device.requestSession(options);
    assert.equal(session.outputContext, undefined);
  });

  it('has `depthNear` that properly get/sets to polyfill', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ exclusive: true });

    polyfill.depthNear = 0.2;
    assert.equal(session.depthNear, 0.2);

    session.depthNear = 0.3;
    assert.equal(polyfill.depthNear, 0.3);
  });

  it('has `depthFar` that properly get/sets to polyfill', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ exclusive: true });

    polyfill.depthFar = 200;
    assert.equal(session.depthFar, 200);

    session.depthFar = 300;
    assert.equal(polyfill.depthFar, 300);
  });

  it('calls polyfilled device `onBaseLayerSet` when setting a baselayer', async function () {
    const global = new MockGlobalVR();
    const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
    const device = new XRDevice(polyfill);
    const session = await device.requestSession({ exclusive: true });
    const fakeLayer = { context: { canvas: {} }};

    session.baseLayer = fakeLayer;
    assert.equal(polyfill.sessions.size, 1);
    let sessionId = null;
    polyfill.sessions.forEach((value) => sessionId = value.id);
    while (!polyfill.sessions.get(sessionId).baseLayer) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(polyfill.sessions.get(sessionId).baseLayer, fakeLayer);
  });

  it('suspends all sessions when an exclusive session starts', async function () {
    const device = createXRDevice();
    return new Promise(async function (resolve) {
      let blur = 0;
      const onBlur = () => {
        blur++;
        if (blur === 5) {
          resolve();
        }
      }

      const pSessions = new Array(5).fill(0).map(() => {
        return device.requestSession({
          outputContext: new XRPresentationContext()
        });
      });

      const sessions = await Promise.all(pSessions);
      sessions.forEach(s => s.addEventListener('blur', onBlur));
      device.requestSession({ exclusive: true });
    });
  });

  it('resumes suspended requestAnimationFrame loop upon `focus`', async function () {
    const device = createXRDevice();
    const session = await device.requestSession({
      outputContext: new XRPresentationContext()
    });

    let blurredOnce = false;
    let blurred = false;
    const onBlur = () => {
      blurred = true;
      blurredOnce = true;
    }
    const onFocus = () => blurred = false;
    const onFrame = (t, frame) => {
      assert.equal(blurred, false);
      session.requestAnimationFrame(onFrame);
    };
    session.addEventListener('blur', onBlur);
    session.addEventListener('focus', onFocus);
    session.requestAnimationFrame(onFrame);

    const exSession = await device.requestSession({ exclusive: true });
    await exSession.end();
    assert.equal(blurredOnce, true);
    assert.equal(blurred, false);
  });

  describe('XRSession#requestFrameOfReference()', () => {
    it('only accepts valid XRFrameOfReferenceTypes', async function () {
      const global = new MockGlobalVR();
      const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
      const device = new XRDevice(polyfill);
      const session = await device.requestSession({ exclusive: true });

      for (const type of ['headModel', 'eyeLevel', 'stage']) {
        const frameOfRef = await session.requestFrameOfReference(type);
        assert.instanceOf(frameOfRef, XRFrameOfReference);
      }

      for (const badType of [undefined, 'outerspace']) {
        let caught = false;
        try {
          await session.requestFrameOfReference(badType);
        } catch (e) {
          caught = true;
        }
        assert.equal(caught, true);
      }
    });
  });

  describe('XRSession#requestAnimationFrame()', () => {
    it('uses the polyfill\'s function for requestAnimationFrame and calls onFrameStart/onFrameEnd', async function () {
      const global = new MockGlobalVR();
      const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
      const device = new XRDevice(polyfill);
      const session = await device.requestSession({ exclusive: true });

      const events = [];
      return new Promise(async function (resolve) {
        polyfill.onFrameStart = function () {
          events.push('framestart');
        };

        polyfill.requestAnimationFrame = function (callback) {
          raf(callback);
          events.push('requestframe');
        };

        polyfill.onFrameEnd = function () {
          events.push('frameend');

          assert.deepEqual(events, ['requestframe', 'framestart', 'callback', 'frameend']);
          resolve();
        };

        session.requestAnimationFrame(function () {
          assert.deepEqual(events, ['requestframe', 'framestart']);
          events.push('callback');
        });
      });
    });
  });

  describe('XRSession#cancelAnimationFrame()', () => {
    it('cancels the frame for the passed in handler', async function () {
      const device = createXRDevice();
      const session = await device.requestSession({ exclusive: true });

      let framesCalled = 0;
      let onFrame = () => framesCalled++;
      let handle = session.requestAnimationFrame(onFrame);
      session.cancelAnimationFrame(handle);

      await new Promise(resolve => raf(resolve));
      assert.equal(framesCalled, 0);

      session.requestAnimationFrame(onFrame);
      // cancel with last frame's handle, so no effect
      session.cancelAnimationFrame(handle);
      await new Promise(resolve => raf(resolve));
      assert.equal(framesCalled, 1);

      // Give it another tick to make sure
      // there's not another frame
      await new Promise(resolve => raf(resolve));
      assert.equal(framesCalled, 1);
    });
  });

  describe('XRSession#end()', () => {
    it('calls the polyfill\'s `end()` function when non-exclusive', async function () {
      const global = new MockGlobalVR();
      const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
      const device = new XRDevice(polyfill);
      const session = await device.requestSession({ outputContext: new XRPresentationContext() });

      let called = false;
      const end = polyfill.endSession;
      polyfill.endSession = id => {
        called = true;
        end.call(polyfill, id);
      };

      await session.end();
      assert.equal(called, true);
    });

    it('fires an `end` event', async function () {
      const global = new MockGlobalVR();
      const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
      const device = new XRDevice(polyfill);
      const session = await device.requestSession({ exclusive: true });

      return new Promise(resolve => {
        session.addEventListener('end', e => {
          assert.equal(e.session, session, 'event has correct `session` attribute');
          resolve();
        });
        session.end();
      });
    });
  });

  describe('events', () => {
    describe('blur', () => {
      it('fires `blur` event when non-exclusive session is suspended', async function () {
        const device = createXRDevice();
        const session = await device.requestSession({
          outputContext: new XRPresentationContext()
        });
        return new Promise(resolve => {
          session.addEventListener('blur', e => {
            assert.equal(e.session, session);
            resolve();
          });

          device.requestSession({ exclusive: true });
        });
      });

      it('propagates a `blur` event from PolyfilledXRDevice');
    });

    describe('focus', () => {
      it('fires `focus` event when non-exclusive session is suspended', async function () {
        const device = createXRDevice();
        const session = await device.requestSession({
          outputContext: new XRPresentationContext()
        });
        return new Promise(async function (resolve) {
          const exSession = await device.requestSession({ exclusive: true });
          session.addEventListener('focus', e => {
            assert.equal(e.session, session);
            resolve();
          });

          await exSession.end();
        });
      });

      it('propagates a `focus` event from PolyfilledXRDevice');
    });

    describe('resetpose', () => {
      it('propagates a `resetpose` event from PolyfilledXRDevice');
    });

    describe('end', () => {
      it('fires `end` event when session is terminated', async function () {
        const device = createXRDevice();
        const session = await device.requestSession({
          outputContext: new XRPresentationContext()
        });
        return new Promise(async function (resolve) {
          session.addEventListener('end', e => {
            assert.equal(e.session, session);
            resolve();
          });

          await session.end();
        });
      });

      it('propagates a `end` event from PolyfilledXRDevice');
    });
  });
});
