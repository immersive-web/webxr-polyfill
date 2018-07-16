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

import XRDevice, { PRIVATE } from '../../src/api/XRDevice';
import XRSession from '../../src/api/XRSession';
import XRPresentationContext from '../../src/api/XRPresentationContext';
import { createXRDevice } from '../lib/utils';
import WebVRDevice from '../../src/devices/WebVRDevice';
import MockVRDisplay from '../lib/MockVRDisplay';
import { MockGlobalVR } from '../lib/globals';

describe('API - XRDevice', () => {

  it('needs a PolyfilledXRDevice', () => {
    assert.throws(() => new XRDevice(), Error);
  });

  it('exposes a PRIVATE named export', () => {
    const device = createXRDevice();
    assert.ok(device[PRIVATE].polyfill);
  });

  function validateOptions (fnName) {
    it('accepts immersive option', async function () {
      const device = createXRDevice();
      return device[fnName]({ immersive: true });
    });

    it('accepts immersive and outputContext option', async function () {
      const device = createXRDevice();
      const ctx = new XRPresentationContext();
      return device[fnName]({ immersive: true, outputContext: ctx });
    });

    it('accepts non-immersive and outputContext option', async function () {
      const device = createXRDevice();
      const ctx = new XRPresentationContext();
      return device[fnName]({ immersive: false, outputContext: ctx });
    });

    it('fails non-immersive without outputContext option', async function () {
      const device = createXRDevice();
      const ctx = new XRPresentationContext();

      let caught = false;
      try {
        await device[fnName]();
      } catch (e) {
        caught = true;
      }
      assert.equal(caught, true);
    });

    it('fails with non-XRPresentationContext outputContext option', async function () {
      const device = createXRDevice();
      const ctx = new XRPresentationContext({ outputContext: {} });

      let caught = false;
      try {
        await device[fnName]();
      } catch (e) {
        caught = true;
      }
      assert.equal(caught, true);
    });

    it('checks PolyfilledXRDevice for custom session support', async function () {
      const global = new MockGlobalVR();
      const polyfill = new WebVRDevice(global, new MockVRDisplay(global));
      if (fnName === 'supportsSession') {
        polyfill[fnName] = () => false;
      } else {
        polyfill[fnName] = () => new Promise((res, rej) => rej());
      }
      const device = new XRDevice(polyfill);
      let caught = false;
      try {
        await device[fnName]({ immersive: true });
      } catch (e) {
        caught = true;
      }
      assert.equal(caught, true);
    });

    it('fails immersive if underlying 1.1 VRDisplay `canPresent` is false', async function () {
      const global = new MockGlobalVR();
      const polyfill = new WebVRDevice(global, new MockVRDisplay(global, { canPresent: false }));
      const device = new XRDevice(polyfill);
      let caught = false;
      try {
        await device[fnName]({ immersive: true });
      } catch (e) {
        caught = true;
      }
      assert.equal(caught, true);
    });
  }

  describe('XRDevice#supportsSession()', () => {
    validateOptions('supportsSession');
  });

  describe('XRDevice#requestSession()', () => {
    it('returns a XRSession', async function () {
      const device = createXRDevice();
      const session = await device.requestSession({ immersive: true });
      assert.instanceOf(session, XRSession);
    });

    it('rejects if requesting a second, concurrent immersive session', async function () {
      const device = createXRDevice();
      const session = await device.requestSession({ immersive: true });
      let caught = false;
      try {
        await device.requestSession({ immersive: true });
      } catch (e) {
        caught = true;
      }
      assert.equal(caught, true);
    });

    it('resolves if requesting a second immersive session after previous immersive ends', async function () {
      const device = createXRDevice();
      const session = await device.requestSession({ immersive: true });
      await session.end();
      await device.requestSession({ immersive: true });
    });

    validateOptions('requestSession');
  });

  describe('events', () => {
    it('propagates a `deactivate` event from PolyfilledXRDevice');
  });
});
