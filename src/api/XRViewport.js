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

export const PRIVATE = Symbol('@@webxr-polyfill/XRViewport');

export default class XRViewport {
  /**
   * Takes a proxy object that this viewport's XRView
   * updates and we serve here to match API.
   *
   * @param {Object} target
   */
  constructor(target) {
    this[PRIVATE] = { target };
  }

  /**
   * @return {number}
   */
  get x() { return this[PRIVATE].target.x; }

  /**
   * @return {number}
   */
  get y() { return this[PRIVATE].target.y; }

  /**
   * @return {number}
   */
  get width() { return this[PRIVATE].target.width; }

  /**
   * @return {number}
   */
  get height() { return this[PRIVATE].target.height; }
}
