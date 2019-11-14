/*
 * Copyright 2019 Google Inc. All Rights Reserved.
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

import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';
import XRDevice from './XRDevice';

const TEST_ENV = process.env.NODE_ENV === 'test';

/**
 * A Session helper class to mirror an XRSession and correlate
 * between an XRSession, and tracking sessions in a XRDevice.
 * Mostly referenced via `session.id` due to needing to verify
 * session creation is possible on the XRDevice before
 * the XRSession can be created.
 */
let SESSION_ID = 0;
class Session {
  constructor(mode, enabledFeatures) {
    this.mode = mode;
    this.enabledFeatures = enabledFeatures;
    this.ended = null;
    this.baseLayer = null;
    this.id = ++SESSION_ID;
  }
};

/**
 * An XRDevice which only supports sensorless inline sessions, used as a
 * fallback when no other type of XRDevice is available as a way to satisfy the
 * spec requirement that inline sessions are always supported.
 */
export default class InlineDevice extends XRDevice {
  /**
   * Constructs an inline-only XRDevice
   */
  constructor(global) {
    super(global);

    this.sessions = new Map();
    this.projectionMatrix = mat4.create();
    this.identityMatrix = mat4.create();
  }

  /**
   * Called when a XRSession has a `baseLayer` property set.
   *
   * @param {number} sessionId
   * @param {XRWebGLLayer} layer
   */
  onBaseLayerSet(sessionId, layer) {
    const session = this.sessions.get(sessionId);
    session.baseLayer = layer;
  }

  /**
   * Returns true if the requested mode is inline
   *
   * @param {XRSessionMode} mode
   * @return {boolean}
   */
  isSessionSupported(mode) {
    return mode == 'inline';
  }

  /**
   * @param {string} featureDescriptor
   * @return {boolean}
   */
  isFeatureSupported(featureDescriptor) {
    switch(featureDescriptor) {
      // Only viewer reference spaces are supported
      case 'viewer': return true;
      default: return false;
    }
  }

  /**
   * Returns a promise of a session ID if creating a session is successful.
   *
   * @param {XRSessionMode} mode
   * @param {Set<string>} enabledFeatures
   * @return {Promise<number>}
   */
  async requestSession(mode, enabledFeatures) {
    if (!this.isSessionSupported(mode)) {
      return Promise.reject();
    }

    const session = new Session(mode, enabledFeatures);

    this.sessions.set(session.id, session);

    return Promise.resolve(session.id);
  }

  /**
   * @return {Function}
   */
  requestAnimationFrame(callback) {
    return window.requestAnimationFrame(callback);
  }

  /**
   * @param {number} handle
   */
  cancelAnimationFrame(handle) {
    window.cancelAnimationFrame(handle);
  }

  onFrameStart(sessionId, renderState) {
    // @TODO Our test environment doesn't have the canvas package for now,
    // but this could be something we add to the tests.
    if (TEST_ENV) {
      return;
    }

    const session = this.sessions.get(sessionId);

    // If the session is inline make sure the projection matrix matches the 
    // aspect ratio of the underlying WebGL canvas.
    if (session.baseLayer) {
      const canvas = session.baseLayer.context.canvas;
      // Update the projection matrix.
      mat4.perspective(this.projectionMatrix, renderState.inlineVerticalFieldOfView,
          canvas.width/canvas.height, renderState.depthNear, renderState.depthFar);
    }
  }

  onFrameEnd(sessionId) {
    // Nothing to do here because inline always renders to the canvas backbuffer
    // directly.
  }

  /**
   * @TODO Spec
   */
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    session.ended = true;
  }

  /**
   * @param {number} sessionId
   * @param {XRReferenceSpaceType} type
   * @return {boolean}
   */
  doesSessionSupportReferenceSpace(sessionId, type) {
    const session = this.sessions.get(sessionId);
    if (session.ended) {
      return false;
    }

    return session.enabledFeatures.has(type);
  }

  /**
   * Inline sessions don't have stage bounds
   *
   * @return {Object?}
   */
  requestStageBounds() {
    return null;
  }

  /**
   * Inline sessions don't have multiple frames of reference
   *
   * @param {XRFrameOfReferenceType} type
   * @param {XRFrameOfReferenceOptions} options
   * @return {Promise<Float32Array>}
   */
  async requestFrameOfReferenceTransform(type, options) {
    return null;
  }

  /**
   * @param {XREye} eye
   * @return {Float32Array}
   */
  getProjectionMatrix(eye) {
    return this.projectionMatrix;
  }

  /**
   * Takes a XREye and a target to apply properties of
   * `x`, `y`, `width` and `height` on. Returns a boolean
   * indicating if it successfully was able to populate
   * target's values.
   *
   * @param {number} sessionId
   * @param {XREye} eye
   * @param {XRWebGLLayer} layer
   * @param {Object?} target
   * @return {boolean}
   */
  getViewport(sessionId, eye, layer, target) {
    // @TODO can we have another layer passed in that
    // wasn't the same one as the `baseLayer`?

    const session = this.sessions.get(sessionId);
    const { width, height } = layer.context.canvas;

    // Inline sessions return the whole canvas as the viewport
    target.x = target.y = 0;
    target.width = width;
    target.height = height;
    return true;
  }

  /**
   * Get model matrix unaffected by frame of reference.
   *
   * @return {Float32Array}
   */
  getBasePoseMatrix() {
    return this.identityMatrix;
  }

  /**
   * Get view matrix unaffected by frame of reference.
   *
   * @param {XREye} eye
   * @return {Float32Array}
   */
  getBaseViewMatrix(eye) {
    return this.identityMatrix;
  }

  /**
   * No persistent input sources for the inline session
   */
  getInputSources() {
    return [];
  }

  getInputPose(inputSource, coordinateSystem, poseType) {
    return null;
  }

  /**
   * Triggered on window resize.
   */
  onWindowResize() {
  }
}
