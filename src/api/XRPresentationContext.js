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

export const PRIVATE = Symbol('@@webxr-polyfill/XRPresentationContext');

export default class XRPresentationContext {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {WebGLRenderingContext} ctx
   * @param {Object?} glAttribs 
   */
  constructor(canvas, ctx, glAttribs) {
    this[PRIVATE] = { canvas, ctx, glAttribs };

    Object.assign(this, ctx);
  }

  /**
   * @return {HTMLCanvasElement}
   */
  get canvas() { return this[PRIVATE].canvas; }
}
