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

import PolyfilledXRDevice from './PolyfilledXRDevice';
import XRDevice from '../api/XRDevice';
import XRPresentationFrame from '../api/XRPresentationFrame';
import XRView from '../api/XRView';
import XRDevicePose from '../api/XRDevicePose';
import { mat4_fromRotationTranslation, mat4_identity, perspective } from '../math';
import { applyCanvasStylesForMinimalRendering } from '../utils';

const PRIVATE = Symbol('@@webxr-polyfill/WebVRDevice');

/**
 * A Session helper class to mirror an XRSession and correlate
 * between an XRSession, and tracking sessions in a PolyfilledXRDevice.
 * Mostly referenced via `session.id` due to needing to verify
 * session creation is possible on the PolyfilledXRDevice before
 * the XRSession can be created.
 */
let SESSION_ID = 0;
class Session {
  constructor(sessionOptions) {
    this.outputContext = sessionOptions.outputContext;
    this.exclusive = sessionOptions.exclusive;
    this.ended = null;
    this.baseLayer = null;
    this.id = ++SESSION_ID;
    // A flag indicating whether or not the canvas used for
    // XRWebGLLayer was injected into the DOM to work around
    // Firefox Desktop bug: https://bugzil.la/1435339
    this.modifiedCanvasLayer = false;
  }
};

export default class WebVRDevice extends PolyfilledXRDevice {
  /**
   * Takes a VRDisplay instance and a VRFrameData
   * constructor from the WebVR 1.1 spec.
   *
   * @param {VRDisplay} display
   * @param {VRFrameData} VRFrameData
   */
  constructor(global, display) {
    const { canPresent } = display.capabilities;
    super(global);

    this.display = display;
    this.frame = new global.VRFrameData();
    this.sessions = new Map();
    this.canPresent = canPresent;
    this.baseModelMatrix = mat4_identity(new Float32Array(16));
    this.tempVec3 = new Float32Array(3);

    this.onVRDisplayPresentChange = this.onVRDisplayPresentChange.bind(this);

    global.window.addEventListener('vrdisplaypresentchange', this.onVRDisplayPresentChange);
  }

  /**
   * @return {number}
   */
  get depthNear() { return this.display.depthNear; }

  /**
   * @param {number}
   */
  set depthNear(val) { this.display.depthNear = val; }

  /**
   * @return {number}
   */
  get depthFar() { return this.display.depthFar; }

  /**
   * @param {number}
   */
  set depthFar(val) { this.display.depthFar = val; }

  /**
   * Called when a XRSession has a `baseLayer` property set.
   *
   * @param {number} sessionId
   * @param {XRWebGLLayer} layer
   */
  onBaseLayerSet(sessionId, layer) {
    const session = this.sessions.get(sessionId);
    const canvas = layer.context.canvas;

    // If we're in an exclusive session, replace the dummy layer on
    // the 1.1 device.
    if (session.exclusive) {
      // Wait for this to resolve before setting session.baseLayer,
      // but we can still safely return this function synchronously
      // We have to set the underlying canvas to the size
      // requested by the 1.1 device.
      const left = this.display.getEyeParameters('left');
      const right = this.display.getEyeParameters('right');

      // Generate height/width due to optics as per 1.1 spec
      canvas.width = Math.max(left.renderWidth, right.renderWidth) * 2;
      canvas.height = Math.max(left.renderHeight, right.renderHeight);
      this.display.requestPresent([{ source: canvas }]).then(() => {
        // If canvas is not in the DOM, we must inject it anyway,
        // due to a bug in Firefox Desktop, and ensure it is visible,
        // so style it to be 1x1 in the upper left corner.
        // https://bugzil.la/1435339
        // Our test environment doesn't have the canvas package, skip
        // in tests for now.
        if (process.env.NODE_ENV !== 'test' &&
            !this.global.document.body.contains(canvas)) {
          session.modifiedCanvasLayer = true;
          this.global.document.body.appendChild(canvas);
          applyCanvasStylesForMinimalRendering(canvas);
        }
        session.baseLayer = layer;
      });
    }
    // If a non-exclusive session that has an outputContext
    // we only have a magic window.
    else if (session.outputContext) {
      session.baseLayer = layer;
    }
  }

  /**
   * If a 1.1 VRDisplay cannot present, it could be a 6DOF device
   * that doesn't have its own way to present, but used in magic
   * window mode. So in WebXR lingo, this cannot support an
   * "exclusive" session.
   *
   * @param {XRSessionCreationOptions} options
   * @return {boolean}
   */
  supportsSession(options={}) {
    if (options.exclusive === true && this.canPresent === false) {
      return false;
    }
    return true;
  }

  /**
   * Returns a promise of a session ID if creating a session is successful.
   * Usually used to set up presentation in the polyfilled device.
   * We can't start presenting in a 1.1 device until we have a canvas
   * layer, so use a dummy layer until `onBaseLayerSet` is called.
   * May reject if session is not supported, or if an error is thrown
   * when calling `requestPresent`.
   *
   * @param {XRSessionCreationOptions} options
   * @return {Promise<number>}
   */
  async requestSession(options={}) {
    if (!this.supportsSession(options)) {
      return Promise.reject();
    }

    // If we're going to present to device, immediately call `requestPresent`
    // since this needs to be inside of a user gesture for Cardboard
    // (requires a user gesture for `requestFullscreen`), as well as
    // WebVR 1.1 requiring to be in a user gesture. Use a dummy canvas,
    // until we get the real canvas to present via `onBaseLayerSet`.
    if (options.exclusive) {
      const canvas = this.global.document.createElement('canvas');

      // Our test environment doesn't have the canvas package, nor this
      // restriction, so skip.
      if (process.env.NODE_ENV !== 'test') {
        // Create and discard a context to avoid
        // "DOMException: Layer source must have a WebGLRenderingContext"
        const ctx = canvas.getContext('webgl');
      }
      await this.display.requestPresent([{ source: canvas }]);
    }

    const session = new Session(options);
    this.sessions.set(session.id, session);

    if (options.exclusive) {
      this.dispatchEvent('@@webxr-polyfill/vr-present-start', session.id);
    }

    return Promise.resolve(session.id);
  }

  /**
   * @return {Function}
   */
  requestAnimationFrame(callback) {
    return this.display.requestAnimationFrame(callback);
  }

  onFrameStart(sessionId) {
    this.display.getFrameData(this.frame);

    // @TODO Our test environment doesn't have the canvas package for now,
    // but this could be something we add to the tests.
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const session = this.sessions.get(sessionId);

    // If the session has an outputContext for magic window, make sure the
    // underlying WebGL canvas is sized to match the output canvas.
    if (session.outputContext && !session.exclusive) {
      const outputCanvas = session.outputContext.canvas;
      const oWidth = outputCanvas.offsetWidth;
      const oHeight = outputCanvas.offsetHeight;
      if (outputCanvas.width != oWidth) {
        outputCanvas.width = oWidth;
      }
      if (outputCanvas.height != oHeight) {
        outputCanvas.height = oHeight;
      }

      const canvas = session.baseLayer.context.canvas;
      if (canvas.width != oWidth) {
        canvas.width = oWidth;
      }
      if (canvas.height != oHeight) {
        canvas.height = oHeight;
      }

      // Update the projection matrix.
      perspective(this.frame.leftProjectionMatrix, Math.PI * 0.4, oWidth/oHeight, this.depthNear, this.depthFar);
    }
  }

  onFrameEnd(sessionId) {
    const session = this.sessions.get(sessionId);

    // Discard if this session is already ended, or if it does
    // not yet have a baseLayer.
    if (session.ended || !session.baseLayer) {
      return;
    }

    // If session is has an outputContext, whether magic window
    // or mirroring (session.exclusive === true), copy the baseLayer
    // pixels to the XRPresentationContext
    // However, abort if this a mirrored context, and our VRDisplay
    // does not have an external display; this kills performance rather
    // quickly on mobile for a canvas that's not seen.
    if (session.outputContext &&
        !(session.exclusive && !this.display.capabilities.hasExternalDisplay)) {
      const mirroring =
        session.exclusive && this.display.capabilities.hasExternalDisplay;

      const canvas = session.baseLayer.context.canvas;
      const iWidth = mirroring ? canvas.width / 2 : canvas.width;
      const iHeight = canvas.height;

      // @TODO Our test environment doesn't have the canvas package for now,
      // but this could be something we add to the tests.
      if (process.env.NODE_ENV !== 'test') {
        // @TODO Cache the context; since XRPresentationContext is created
        // outside of the main API and does not expose the underlying context
        const outputCanvas = session.outputContext.canvas;
        const outputContext = outputCanvas.getContext('2d');
        const oWidth = outputCanvas.width;
        const oHeight = outputCanvas.height;

        // We want to render only half of the layer context (left eye)
        // proportional to the size of the outputContext canvas.
        // ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        outputContext.drawImage(canvas, 0, 0, iWidth, iHeight,
                                        0, 0, oWidth, oHeight);
      }
    }

    // Only submit frame if we're presenting an exclusive session.
    // on a session will start presenting in 1.1 but we still have
    // to set up the width/height correctly and wait for `baseLayer` to
    // be set.
    if (session.exclusive && session.baseLayer) {
      this.display.submitFrame();
    }
  }

  /**
   * @param {number} handle
   */
  cancelAnimationFrame(handle) {
    this.display.cancelAnimationFrame(handle);
  }

  /**
   * @TODO Spec
   */
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (session.ended) {
      return;
    }

    // If this is an exclusive session, end presenting;
    // the vrdisplaypresentchange event will flip the `ended` bit.
    if (session.exclusive) {
      return this.display.exitPresent();
    } else {
      session.ended = true;
    }
  }

  /**
   * If the VRDisplay has stage parameters, convert them
   * to an array of X, Z pairings.
   *
   * @return {Object?}
   */
  requestStageBounds() {
    if (this.display.stageParameters) {
      const width = this.display.stageParameters.sizeX;
      const depth = this.display.stageParameters.sizeZ;
      const data = [];

      data.push(-width / 2); // X
      data.push(-depth / 2); // Z
      data.push(width / 2); // X
      data.push(-depth / 2); // Z
      data.push(width / 2); // X
      data.push(depth / 2); // Z
      data.push(-width / 2); // X
      data.push(depth / 2); // Z

      return data;
    }
    return null;
  }

  /**
   * Returns a promise resolving to a transform if PolyfilledXRDevice
   * can support frame of reference and provides its own values.
   * Can resolve to `undefined` if the polyfilled API can provide
   * a default. Rejects if this PolyfilledXRDevice cannot
   * support the frame of reference.
   *
   * @param {XRFrameOfReferenceType} type
   * @param {XRFrameOfReferenceOptions} options
   * @return {Promise<XRFrameOfReference>}
   */
  async requestFrameOfReferenceTransform(type, options) {
    if (type === 'stage' && this.display.stageParameters &&
                            this.display.stageParameters.sittingToStandingTransform) {
      return this.display.stageParameters.sittingToStandingTransform;
    }
  }

  /**
   * @param {XREye} eye
   * @return {Float32Array}
   */
  getProjectionMatrix(eye) {
    if (eye === 'left') {
      return this.frame.leftProjectionMatrix;
    } else if (eye === 'right') {
      return this.frame.rightProjectionMatrix;
    } else {
      throw new Error(`eye must be of type 'left' or 'right'`);
    }
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

    // If this is a non-exclusive session, return the
    // whole canvas as the viewport
    if (!session.exclusive) {
      target.x = target.y = 0;
      target.width = width;
      target.height = height;
      return true;
    }

    // WebGL 1.1 viewports are just
    if (eye === 'left') {
      target.x = 0;
    } else if (eye === 'right') {
      target.x = width / 2;
    } else {
      return false;
    }

    target.y = 0;
    target.width = width / 2;
    target.height = height;

    return true;
  }

  /**
   * Get model matrix unaffected by frame of reference.
   *
   * @return {Float32Array}
   */
  getBasePoseMatrix() {
    let { position, orientation } = this.frame.pose;
    // On initialization, we might not have any values
    if (!position && !orientation) {
      return this.baseModelMatrix;
    }
    if (!position) {
      position = this.tempVec3;
      position[0] = position[1] = position[2] = 0;
    }
    mat4_fromRotationTranslation(this.baseModelMatrix, orientation, position);
    return this.baseModelMatrix;
  }

  /**
   * Get view matrix unaffected by frame of reference.
   *
   * @param {XREye} eye
   * @return {Float32Array}
   */
  getBaseViewMatrix(eye) {
    if (eye === 'left') {
      return this.frame.leftViewMatrix;
    } else if (eye === 'right') {
      return this.frame.rightViewMatrix;
    } else {
      throw new Error(`eye must be of type 'left' or 'right'`);
    }
  }

  /**
   * Triggered on window resize.
   *
   */
  onWindowResize() {
  }

  /**
   * Listens to the Native 1.1 `window.addEventListener('vrdisplaypresentchange')`
   * event.
   *
   * @param {Event} event
   */
  onVRDisplayPresentChange(e) {
    if (!this.display.isPresenting) {
      this.sessions.forEach(session => {
        if (session.exclusive && !session.ended) {
          // If we injected and modified the canvas layer
          // due to https://bugzil.la/1435339, then remove it from the DOM
          // and remove styles.
          if (session.modifiedCanvasLayer) {
            const canvas = session.baseLayer.context.canvas;
            document.body.removeChild(canvas);
            canvas.setAttribute('style', '');
          }
          this.dispatchEvent('@@webxr-polyfill/vr-present-end', session.id);
        }
      });
    }
  }
}
