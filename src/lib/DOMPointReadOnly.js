/*
 * Copyright 2018 Google Inc. All Rights Reserved.
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

import GLOBAL from './global';

let domPointROExport = ('DOMPointReadOnly' in GLOBAL) ? DOMPointReadOnly : null;

if (!domPointROExport) {
  const PRIVATE = Symbol('@@webxr-polyfill/DOMPointReadOnly');

  domPointROExport = class DOMPointReadOnly {
    constructor(x, y, z, w) {
      if (arguments.length === 1) {
        this[PRIVATE] = {
          x: x.x,
          y: x.y,
          z: x.z,
          w: x.w
        };
      } else if (arguments.length === 4) {
        this[PRIVATE] = {
          x: x,
          y: y,
          z: z,
          w: w
        };
      } else {
        throw new TypeError('Must supply either 1 or 4 arguments')
      }
    }

    /**
     * @return {number}
     */
    get x() { return this[PRIVATE].x }

    /**
     * @return {number}
     */
    get y() { return this[PRIVATE].y }

    /**
     * @return {number}
     */
    get z() { return this[PRIVATE].z }

    /**
     * @return {number}
     */
    get w() { return this[PRIVATE].w }
  }
}

export default domPointROExport;
