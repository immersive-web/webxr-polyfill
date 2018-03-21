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

import XRSession from './XRSession';
import XRLayer from './XRLayer';
import {
  POLYFILLED_COMPATIBLE_XR_DEVICE,
  COMPATIBLE_XR_DEVICE,
} from '../constants';

const PRIVATE = Symbol('@@webxr-polyfill/XRWebGLLayer');

export const XRWebGLLayerInit = Object.freeze({
  antialias: true,
  depth: false,
  stencil: false,
  alpha: true,
  multiview: false,
  framebufferScaleFactor: 0,
});

export default class XRWebGLLayer extends XRLayer {
  constructor(session, context, layerInit={}) {
    const config = Object.assign({}, XRWebGLLayerInit, layerInit);

    if (!(session instanceof XRSession)) {
      throw new Error('session must be a XRSession');
    }

    if (session.ended) {
      throw new Error(`InvalidStateError`);
    }

    // Since we're polyfilling, we're probably polyfilling
    // the compatible XR device bit as well. It'd be
    // unusual for this bit to not be polyfilled.
    if (context[POLYFILLED_COMPATIBLE_XR_DEVICE]) {
      if (context[COMPATIBLE_XR_DEVICE] !== session.device) {
        throw new Error(`InvalidStateError`);
      }
    }

    // Use the default framebuffer
    const framebuffer = context.getParameter(context.FRAMEBUFFER_BINDING);

    super();
    this[PRIVATE] = {
      context,
      config,
      framebuffer,
    };
  }

  /**
   * @return {WebGLRenderingContext}
   */
  get context() { return this[PRIVATE].context; }

  /**
   * @return {boolean}
   */
  get antialias() { return this[PRIVATE].config.antialias; }

  /**
   * @return {boolean}
   */
  get depth() { return this[PRIVATE].config.depth; }

  /**
   * @return {boolean}
   */
  get stencil() { return this[PRIVATE].config.stencil; }

  /**
   * @return {boolean}
   */
  get alpha() { return this[PRIVATE].config.alpha; }

  /**
   * Not yet supported.
   *
   * @return {boolean}
   */
  get multiview() { return false; }

  /**
   * @return {WebGLFramebuffer}
   */
  get framebuffer() { return this[PRIVATE].framebuffer; }

  /**
   * @return {number}
   */
  get framebufferWidth() { return this[PRIVATE].context.drawingBufferWidth; }

  /**
   * @return {number}
   */
  get framebufferHeight() { return this[PRIVATE].context.drawingBufferHeight; }

  /**
   * Not yet supported.
   *
   * @param {number} viewportScaleFactor
   */
  requestViewportScaling(viewportScaleFactor) {
    console.warn('requestViewportScaling is not yet implemented');
  }
}
