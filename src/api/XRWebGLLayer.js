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

import XRSession, { PRIVATE as SESSION_PRIVATE } from './XRSession';
import {
  POLYFILLED_XR_COMPATIBLE,
  XR_COMPATIBLE,
} from '../constants';

export const PRIVATE = Symbol('@@webxr-polyfill/XRWebGLLayer');

export const XRWebGLLayerInit = Object.freeze({
  antialias: true,
  depth: false,
  stencil: false,
  alpha: true,
  multiview: false,
  ignoreDepthValues: false,
  framebufferScaleFactor: 1.0,
});

export default class XRWebGLLayer {
  /**
   * @param {XRSession} session 
   * @param {XRWebGLRenderingContext} context 
   * @param {Object?} layerInit 
   */
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
    if (context[POLYFILLED_XR_COMPATIBLE]) {
      if (context[XR_COMPATIBLE] !== true) {
        throw new Error(`InvalidStateError`);
      }
    }

    // Use the default framebuffer
    const framebuffer = context.getParameter(context.FRAMEBUFFER_BINDING);

    this[PRIVATE] = {
      context,
      config,
      framebuffer,
      session,
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
   * The polyfill will always ignore depth values.
   *
   * @return {boolean}
   */
  get ignoreDepthValues() { return true; }

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
   * @return {XRSession}
   */
  get _session() { return this[PRIVATE].session; }

  /**
   * @TODO No mention in spec on not reusing the XRViewport on every frame.
   * 
   * @TODO In the future maybe all this logic should be handled here instead of
   * delegated to the XRView?
   *
   * @param {XRView} view
   * @return {XRViewport?}
   */
  getViewport(view) {
    return view._getViewport(this);
  }

  /**
   * Gets the scale factor to be requested if you want to match the device
   * resolution at the center of the user's vision. The polyfill will always
   * report 1.0.
   * 
   * @param {XRSession} session 
   * @return {number}
   */
  static getNativeFramebufferScaleFactor(session) {
    if (!session) {
      throw new TypeError('getNativeFramebufferScaleFactor must be passed a session.')
    }

    if (session[SESSION_PRIVATE].ended) { return 0.0; }

    return 1.0;
  }
}
