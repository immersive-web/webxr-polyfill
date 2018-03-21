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
import XRDevice from '../src/api/XRDevice';
import { createXRDevice } from './lib/utils';
import { MockGlobal } from './lib/globals';

const mockRequestDevice = () => new Promise(resolve => setTimeout(resolve, 5));

const makeMobile = global => {
  const realUA = global.navigator.userAgent;
  Object.defineProperty(global.navigator, 'userAgent', {
    get: () => `${realUA} iphone`,
  });
}

describe('WebXRPolyfill', () => {
  describe('injecting', () => {
    it('polyfills the WebXR API if navigator.xr does not exist', () => {
      const global = new MockGlobal();
      assert.ok(!global.navigator.xr);
      const polyfill = new WebXRPolyfill(global);
      assert.ok(global.navigator.xr);
      assert.equal(polyfill.injected, true);
    });

    it('does not polyfill if navigator.xr already exists', () => {
      const global = new MockGlobal();
      // Inject the API to start as if it were native
      new WebXRPolyfill(global);

      const polyfill = new WebXRPolyfill(global);
      assert.ok(global.navigator.xr);
      assert.equal(polyfill.injected, false);
    });
  });

  describe('patching', () => {
    it('does not patch `xr.requestDevice` if exists when on desktop', () => {
      const global = new MockGlobal();
      // Inject the API to start as if it were native
      new WebXRPolyfill(global);
      global.navigator.xr.requestDevice = mockRequestDevice;

      const polyfill = new WebXRPolyfill(global);
      assert.equal(polyfill.injected, false);
      assert.ok(global.navigator.xr.requestDevice === mockRequestDevice);
    });

    it('does not patch `xr.requestDevice` if exists on mobile when cardboard is false', () => {
      const global = new MockGlobal();
      makeMobile(global);
      // Inject the API to start as if it were native
      new WebXRPolyfill(global);
      global.navigator.xr.requestDevice = mockRequestDevice;

      const polyfill = new WebXRPolyfill(global, { cardboard: false });
      assert.equal(polyfill.injected, false);
      assert.ok(global.navigator.xr.requestDevice === mockRequestDevice);
    });

    it('patches `xr.requestDevice` if exists on mobile and cardboard is true', () => {
      const global = new MockGlobal();
      makeMobile(global);
      // Inject the API to start as if it were native
      new WebXRPolyfill(global);
      global.navigator.xr.requestDevice = mockRequestDevice;

      const polyfill = new WebXRPolyfill(global, { cardboard: true });
      assert.equal(polyfill.injected, false);
      assert.ok(global.navigator.xr.requestDevice !== mockRequestDevice);
    });
  });
});
