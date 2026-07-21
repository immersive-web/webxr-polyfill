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

import WebXRPolyfill from '../src/WebXRPolyfill';
import { requestDevice } from '../src/devices';
import XRDevice from '../src/api/XRDevice';
import MockVRDisplay from './lib/MockVRDisplay';
import { MockGlobal, MockGlobalVR } from './lib/globals';

const makeMobile = global => {
  const realUA = global.navigator.userAgent;
  Object.defineProperty(global.navigator, 'userAgent', {
    get: () => `${realUA} iphone`,
  });
};

const addXR = (global, device) => {
  const xr = {
    requestDevice: () => new Promise(resolve => resolve(device)),
  };

  Object.defineProperty(global.navigator, 'xr', {
    get: () => xr,
  });
};

const addVR = (global, display) => {
  global.navigator.getVRDisplays = () => new Promise(resolve => resolve(display ? [display] : []));
  return;
  Object.defineProperty(global.navigator, 'getVRDisplays', {
    get: () => new Promise(resolve => resolve(display ? [display] : [])),
  });
};

describe('devices - requestDevice', () => {
  it('returns XRDevice if exists', async function () {
    const global = new MockGlobal();
    const xrDevice = {};
    const vrDevice = {};
    addXR(global, xrDevice);
    addVR(global, vrDevice);
    makeMobile(global);

    const device = await requestDevice(global, { cardboard: true, webvr: true });
    assert.equal(device, xrDevice);
  });

  it('returns wrapped VRDisplay if no native XRDevice exists', async function () {
    const global = new MockGlobalVR();
    const vrDevice = new MockVRDisplay();
    addVR(global, vrDevice);

    const device = await requestDevice(global, { cardboard: true, webvr: true });
    assert.equal(device.polyfill.display, vrDevice);
    assert.instanceOf(device, XRDevice);
  });

  it('returns wrapped CardboardVRDisplay if no native XRDevice or VRDisplay exists', async function () {
    const global = new MockGlobalVR();
    addVR(global);
    makeMobile(global);
    const device = await requestDevice(global, { cardboard: true, webvr: true });
    assert.instanceOf(device, XRDevice);
    assert.instanceOf(device.polyfill.display, MockVRDisplay);
  });

  it('returns wrapped CardboardVRDisplay if no native WebXR/WebVR implementations exists', async function () {
    const global = new MockGlobal();
    makeMobile(global);
    const device = await requestDevice(global, { cardboard: true, webvr: true });
    assert.instanceOf(device, XRDevice);
    assert.instanceOf(device.polyfill.display, MockVRDisplay);
  });

  it('returns wrapped CardboardVRDisplay if no native XRDevice and webvr disabled', async function () {
    const global = new MockGlobal();
    makeMobile(global);
    const vrDevice = new MockVRDisplay();
    addVR(global, vrDevice);
    const device = await requestDevice(global, { cardboard: true, webvr: false });
    assert.instanceOf(device, XRDevice);
    assert.instanceOf(device.polyfill.display, MockVRDisplay);
  });

  it('returns no devices if no native support and not on mobile', async function () {
    const global = new MockGlobal();
    const device = await requestDevice(global, { cardboard: true });
    assert.equal(device, null);
  });

  it('returns no devices if no native support and cardboard is false', async function () {
    const global = new MockGlobal();
    makeMobile(global);
    const device = await requestDevice(global, { cardboard: false });
    assert.equal(device, null);
  });
});
