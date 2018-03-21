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

import { JSDOM } from 'jsdom';

/**
 * A mocked "global" object that contains all the necessary
 * globals that the polyfill needs for injection and WebGL polyfilling.
 *
 * Polyfilled properties:
 *
 * `window`
 * `navigator`
 * `document`
 */

export class MockGlobal {
  constructor() {
    const { window } = new JSDOM(`<!DOCTYPE html><p>Hello, WebXR</p>`);
    this.window = window;
    this.document = window.document;
    this.navigator = window.navigator;
    this.HTMLCanvasElement = {};
    this.WebGLRenderingContext = {};
  }
}

export class MockGlobalVR extends MockGlobal {
  constructor() {
    super(); 
    this.VRFrameData = function VRFrameData() {
      this.leftProjectionMatrix = new Float32Array(16);
      this.rightProjectionMatrix = new Float32Array(16);
      this.leftViewMatrix = new Float32Array(16);
      this.rightViewMatrix = new Float32Array(16);
      this.timestamp = null;
      this.pose = {
        position: new Float32Array(3),
        orientation: new Float32Array(4),
      };
    };
  }
}
