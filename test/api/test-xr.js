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

import XR from '../../src/api/XR';
import XRDevice from '../../src/api/XRDevice';
import { createXRDevice } from '../lib/utils';

describe('API - XR', () => {
  describe('XR#requestDevice()', () => {
    it('returns seeded thennable devices', async function () {
      const device = createXRDevice();
      const pDevice = new Promise(resolve => resolve(device));
      const xr = new XR(pDevice);
      const rDevice = await xr.requestDevice();
      assert.equal(rDevice, device);
    });
  });

  describe('events', () => {
    it('propagates a `deviceconnect` event from PolyfilledXRDevice');
    it('propagates a `devicedisconnect` event from PolyfilledXRDevice');
  });
});
