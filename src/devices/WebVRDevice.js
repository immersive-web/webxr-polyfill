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

import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';
import XRDevice from './XRDevice';
import GamepadXRInputSource from './GamepadXRInputSource';
import {
  isImageBitmapSupported,
  applyCanvasStylesForMinimalRendering
} from '../utils';

const PRIVATE = Symbol('@@webxr-polyfill/WebVRDevice');
const TEST_ENV = process.env.NODE_ENV === 'test';

const EXTRA_PRESENTATION_ATTRIBUTES = {
  // Non-standard attribute to enable running at the native device refresh rate
  // on the Oculus Go.
  highRefreshRate: true,
};

// If a gamepad id string includes the name of the key from the map, the button
// index given will be the one used as that controller's primary action button
// rather than the default of button 0.
const PRIMARY_BUTTON_MAP = {
  oculus: 1,
  openvr: 1,
  'spatial controller (spatial interaction source)': 1
};

/**
 * A Session helper class to mirror an XRSession and correlate
 * between an XRSession, and tracking sessions in a XRDevice.
 * Mostly referenced via `session.id` due to needing to verify
 * session creation is possible on the XRDevice before
 * the XRSession can be created.
 */
let SESSION_ID = 0;
class Session {
  constructor(mode, enabledFeatures, polyfillOptions={}) {
    this.mode = mode;
    this.enabledFeatures = enabledFeatures;
    this.outputContext = null;
    this.immersive = mode == 'immersive-vr' || mode == 'immersive-ar';
    this.ended = null;
    this.baseLayer = null;
    this.id = ++SESSION_ID;

    // Since XRPresentationContext is created outside of the main API
    // and does not expose the real 2d/bitmaprender context, manually fetch
    // it and store it.
    if (this.outputContext && !TEST_ENV) {
      const renderContextType = polyfillOptions.renderContextType || '2d';
      this.renderContext = this.outputContext.canvas.getContext(renderContextType);
    }
  }
};

export default class WebVRDevice extends XRDevice {
  /**
   * Takes a VRDisplay instance and a VRFrameData
   * constructor from the WebVR 1.1 spec.
   *
   * @param {VRDisplay} display
   * @param {Object} webvrConfig
   * @param {VRFrameData} VRFrameData
   */
  constructor(global, webvrConfig, display) {
    const { canPresent } = display.capabilities;
    super(global);

    this.display = display;
    this.frame = new global.VRFrameData();
    this.sessions = new Map();
    this.immersiveSession = null;
    this.canPresent = canPresent;
    this.baseModelMatrix = mat4.create();
    this.gamepadInputSources = {};
    this.tempVec3 = new Float32Array(3);

    this.immersiveCanvas = null;
    this.immersiveCanvasInjectedInDOM = false;

    // This canvas is the placeholder passed to requestPresent when the XRSession.baseLayer is set to null
    // so style it to be 1x1 in the upper left corner.
    this.placeholderCanvas = this.global.document.createElement('canvas');
    applyCanvasStylesForMinimalRendering(this.placeholderCanvas);

    // Our test environment doesn't have the canvas package, nor this
    // restriction, so skip.
    if (!TEST_ENV) {
      // Create and discard a context to avoid
      // "DOMException: Layer source must have a WebGLRenderingContext"
      const ctx = this.placeholderCanvas.getContext('webgl');
    }

    // This canvas should be used instead of the placeholder in the first call to requestPresent
    this.initialCanvas = webvrConfig ? webvrConfig.initialCanvas : null;

    this.onVRDisplayPresentChange = this.onVRDisplayPresentChange.bind(this);

    global.window.addEventListener('vrdisplaypresentchange', this.onVRDisplayPresentChange);

    this.CAN_USE_GAMEPAD = global.navigator && ('getGamepads' in global.navigator);
    this.HAS_BITMAP_SUPPORT = isImageBitmapSupported(global);
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

    if (session.immersive) {
      // Wait for this to resolve before setting session.baseLayer,
      // but we can still safely return this function synchronously
      // We have to set the underlying canvas to the size
      // requested by the 1.1 device.

      let canvas;
      if (layer) {
        canvas = layer.context.canvas;
        const left = this.display.getEyeParameters('left');
        const right = this.display.getEyeParameters('right');
        
        // Generate height/width due to optics as per 1.1 spec
        canvas.width = Math.max(left.renderWidth, right.renderWidth) * 2;
        canvas.height = Math.max(left.renderHeight, right.renderHeight);
      } else {
        canvas = this.placeholderCanvas;
      }

      if (this.immersiveCanvas !== canvas) {
        this.setImmersiveCanvas(canvas);
        this.display.requestPresent([{
          source: canvas, attributes: EXTRA_PRESENTATION_ATTRIBUTES
        }]).then(() => {
          session.baseLayer = layer;
        });
      } else {
        session.baseLayer = layer;
      } 
    }
    // If a non-immersive session that has an outputContext
    // we only have a magic window.
    else {
      session.baseLayer = layer;
    }
  }

  /**
   * If a 1.1 VRDisplay cannot present, it could be a 6DOF device
   * that doesn't have its own way to present, but used in magic
   * window mode. So in WebXR lingo, this cannot support an
   * "immersive" session.
   *
   * @param {XRSessionMode} mode
   * @return {boolean}
   */
  isSessionSupported(mode) {
    // AR is not supported by the WebVRDevice
    if (mode == 'immersive-ar') {
      return false;
    }
    if (mode == 'immersive-vr' && this.canPresent === false) {
      return false;
    }
    return true;
  }

  /**
   * @param {string} featureDescriptor
   * @return {boolean}
   */
  isFeatureSupported(featureDescriptor) {
    switch(featureDescriptor) {
      case 'viewer': return true;
      case 'local': return true;
      case 'local-floor': return true;

      // TODO: We *can* support 'bounded-floor' reference spaces with what WebVR
      // gives us, but it'll take some additional work and may have tricky
      // timing issues.
      case 'bounded': return false;

      // 'unbounded' is unlikely to ever be supported by the polyfill, since
      // it's pretty much impossible to do correctly without native support.
      case 'unbounded': return false;
      default: return false;
    }
  }

  /**
   * Returns a promise of a session ID if creating a session is successful.
   * Usually used to set up presentation in the device.
   * We can't start presenting in a 1.1 device until we have a canvas
   * layer, so use a dummy layer until `onBaseLayerSet` is called.
   * May reject if session is not supported, or if an error is thrown
   * when calling `requestPresent`.
   *
   * @param {XRSessionMode} mode
   * @param {Set<string>} enabledFeatures
   * @return {Promise<number>}
   */
  async requestSession(mode, enabledFeatures) {
    if (!this.isSessionSupported(mode)) {
      return Promise.reject();
    }

    let immersive = mode == 'immersive-vr';

    // If we're going to present to device, immediately call `requestPresent`
    // since this needs to be inside of a user gesture for Cardboard
    // (requires a user gesture for `requestFullscreen`), as well as
    // WebVR 1.1 requiring to be in a user gesture. Use a placeholder canvas,
    // until we get the real canvas to present via `onBaseLayerSet`.
    if (immersive) {
      const canvas = this.initialCanvas ? this.initialCanvas : this.placeholderCanvas;
      await this.display.requestPresent([{
          source: canvas, attributes: EXTRA_PRESENTATION_ATTRIBUTES }]);
      this.setImmersiveCanvas(canvas);
    }

    const session = new Session(mode, enabledFeatures, {
      renderContextType: this.HAS_BITMAP_SUPPORT ? 'bitmaprenderer' : '2d'
    });

    this.sessions.set(session.id, session);

    if (immersive) {
      this.immersiveSession = session;
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

  getPrimaryButtonIndex(gamepad) {
    let primaryButton = 0;
    let name = gamepad.id.toLowerCase();
    for (let key in PRIMARY_BUTTON_MAP) {
      if (name.includes(key)) {
        primaryButton = PRIMARY_BUTTON_MAP[key];
        break;
      }
    }
    // Make sure the index is actually in the button range.
    return Math.min(primaryButton, gamepad.buttons.length - 1);
  }

  onFrameStart(sessionId, renderState) {
    this.display.depthNear = renderState.depthNear;
    this.display.depthFar = renderState.depthFar

    this.display.getFrameData(this.frame);

    const session = this.sessions.get(sessionId);

    if (session.immersive && this.CAN_USE_GAMEPAD) {
      // Update inputs from gamepad data
      let prevInputSources = this.gamepadInputSources;
      this.gamepadInputSources = {};
      let gamepads = this.global.navigator.getGamepads();
      for (let i = 0; i < gamepads.length; ++i) {
        let gamepad = gamepads[i];
        // Supposedly the gamepad's displayId should match the VRDisplay's id,
        // but in practice anything with a non-zero displayId is an XR
        // controller, which is almost certainly associated with any VRDisplay
        // we were able to get.
        if (gamepad && gamepad.displayId > 0) {
          // Found a gamepad input source for this index.
          let inputSourceImpl = prevInputSources[i];
          if (!inputSourceImpl) {
            inputSourceImpl = new GamepadXRInputSource(this, this.display, this.getPrimaryButtonIndex(gamepad));
          }
          inputSourceImpl.updateFromGamepad(gamepad);
          this.gamepadInputSources[i] = inputSourceImpl;

          // Process the primary action for the controller
          if (inputSourceImpl.primaryButtonIndex != -1) {
            let primaryActionPressed = gamepad.buttons[inputSourceImpl.primaryButtonIndex].pressed;
            if (primaryActionPressed && !inputSourceImpl.primaryActionPressed) {
              this.dispatchEvent('@@webxr-polyfill/input-select-start', { sessionId: session.id, inputSource: inputSourceImpl.inputSource });
            } else if (!primaryActionPressed && inputSourceImpl.primaryActionPressed) {
              // This will also fire a select event
              this.dispatchEvent('@@webxr-polyfill/input-select-end', { sessionId: session.id, inputSource: inputSourceImpl.inputSource });
            }
            inputSourceImpl.primaryActionPressed = primaryActionPressed;
          }
          if (inputSourceImpl.primarySqueezeButtonIndex != -1) {
            let primarySqueezeActionPressed = gamepad.buttons[inputSourceImpl.primarySqueezeButtonIndex].pressed;
            if (primarySqueezeActionPressed && !inputSourceImpl.primarySqueezeActionPressed) {
              this.dispatchEvent('@@webxr-polyfill/input-squeeze-start', { sessionId: session.id, inputSource: inputSourceImpl.inputSource });
            } else if (!primarySqueezeActionPressed && inputSourceImpl.primarySqueezeActionPressed) {
              // This will also fire a select event
              this.dispatchEvent('@@webxr-polyfill/input-squeeze-end', { sessionId: session.id, inputSource: inputSourceImpl.inputSource });
            }
            inputSourceImpl.primarySqueezeActionPressed = primarySqueezeActionPressed;
          }
        }
      }
    }

    // @TODO Our test environment doesn't have the canvas package for now,
    // but this could be something we add to the tests.
    if (TEST_ENV) {
      return;
    }

    // If the session is inline make sure the projection matrix matches the 
    // aspect ratio of the underlying WebGL canvas.
    if (!session.immersive && session.baseLayer) {
      const canvas = session.baseLayer.context.canvas;
      // Update the projection matrix.
      mat4.perspective(this.frame.leftProjectionMatrix, renderState.inlineVerticalFieldOfView,
          canvas.width/canvas.height, renderState.depthNear, renderState.depthFar);
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
    // or mirroring (session.immersive === true), copy the baseLayer
    // pixels to the XRPresentationContext
    // However, abort if this a mirrored context, and our VRDisplay
    // does not have an external display; this kills performance rather
    // quickly on mobile for a canvas that's not seen.
    if (session.outputContext &&
        !(session.immersive && !this.display.capabilities.hasExternalDisplay)) {
      const mirroring =
        session.immersive && this.display.capabilities.hasExternalDisplay;

      const iCanvas = session.baseLayer.context.canvas;
      const iWidth = mirroring ? iCanvas.width / 2 : iCanvas.width;
      const iHeight = iCanvas.height;

      // @TODO Our test environment doesn't have the canvas package for now,
      // but this could be something we add to the tests.
      if (!TEST_ENV) {
        const oCanvas = session.outputContext.canvas;
        const oWidth = oCanvas.width;
        const oHeight = oCanvas.height;

        // The real underlying RenderContext that will display content
        // for the polyfilled XRPresentationContext
        const renderContext = session.renderContext;

        // If we're using an ImageBitmapRenderingContext as our XRPresentationContext
        if (this.HAS_BITMAP_SUPPORT) {
          // If the developer is using an OffscreenCanvas, and ImageBitmapRenderingContext
          // is supported, transfer the bitmap directly.
          if (iCanvas.transferToImageBitmap) {
            renderContext.transferFromImageBitmap(iCanvas.transferToImageBitmap());
          }
          // Otherwise we're using an HTMLCanvasElement, so we async generate
          // a bitmap and then transfer the bitmap directly.
          // @TODO does this technique result in always being a frame behind?
          else {
            this.global.createImageBitmap(iCanvas, 0, 0, iWidth, iHeight, {
              resizeWidth: oWidth,
              resizeHeight: oHeight,
            }).then(bitmap => renderContext.transferFromImageBitmap(bitmap));
          }
        } else {

          // We want to render only half of the layer context (left eye)
          // proportional to the size of the outputContext canvas.
          // ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
          renderContext.drawImage(iCanvas, 0, 0, iWidth, iHeight,
                                           0, 0, oWidth, oHeight);
        }
      }
    }

    // Only submit frame if we're presenting an immersive session.
    // on a session will start presenting in 1.1 but we still have
    // to set up the width/height correctly and wait for `baseLayer` to
    // be set.
    if (session.immersive && session.baseLayer) {
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

    // If this is an immersive session, end presenting;
    // the vrdisplaypresentchange event will flip the `ended` bit.
    if (session.immersive) {
      return this.display.exitPresent();
    } else {
      session.ended = true;
    }
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
   * Returns a promise resolving to a transform if XRDevice
   * can support frame of reference and provides its own values.
   * Can resolve to `undefined` if the polyfilled API can provide
   * a default. Rejects if this XRDevice cannot
   * support the frame of reference.
   *
   * @param {XRFrameOfReferenceType} type
   * @param {XRFrameOfReferenceOptions} options
   * @return {Promise<float32rray>}
   */
  async requestFrameOfReferenceTransform(type, options) {
    if ((type === 'local-floor' || type === 'bounded-floor') &&
        this.display.stageParameters &&
        this.display.stageParameters.sittingToStandingTransform) {
      return this.display.stageParameters.sittingToStandingTransform;
    }

    return null;
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
    } else if (eye === 'none') {
      return this.frame.leftProjectionMatrix;
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

    // If this is a non-immersive session, return the
    // whole canvas as the viewport
    if (!session.immersive) {
      target.x = target.y = 0;
      target.width = width;
      target.height = height;
      return true;
    }

    // WebGL 1.1 viewports are just
    if (eye === 'left' || eye === 'none') {
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
    mat4.fromRotationTranslation(this.baseModelMatrix, orientation, position);
    return this.baseModelMatrix;
  }

  /**
   * Get view matrix unaffected by frame of reference.
   *
   * @param {XREye} eye
   * @return {Float32Array}
   */
  getBaseViewMatrix(eye) {
    if (eye === 'left' || eye === 'none') {
      return this.frame.leftViewMatrix;
    } else if (eye === 'right') {
      return this.frame.rightViewMatrix;
    } else {
      throw new Error(`eye must be of type 'left' or 'right'`);
    }
  }

  getInputSources() {
    let inputSources = [];
    for (let i in this.gamepadInputSources) {
      inputSources.push(this.gamepadInputSources[i].inputSource);
    }
    return inputSources;
  }

  getInputPose(inputSource, coordinateSystem, poseType) {
    if (!coordinateSystem) {
      return null;
    }

    for (let i in this.gamepadInputSources) {
      let inputSourceImpl = this.gamepadInputSources[i];
      if (inputSourceImpl.inputSource === inputSource) {
        return inputSourceImpl.getXRPose(coordinateSystem, poseType);
      }
    }
    return null;
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
        if (session.immersive && !session.ended) {
          if (this.immersiveSession === session) {
            this.setImmersiveCanvas(null);
            this.immersiveSession = null;
          }
          this.dispatchEvent('@@webxr-polyfill/vr-present-end', session.id);
        }
      });
    }
  }

  /**
   * Ensure the canvas is added to the dom if necessary to work around https://bugzil.la/1435339.
   * Remove it from the DOM when no longer needed.
   * @param {Canvas} canvas 
   */
  setImmersiveCanvas(canvas) {
    if (this.immersiveCanvas !== canvas) {

      if (this.immersiveCanvasInjectedInDOM) {
        document.body.removeChild(this.immersiveCanvas);
        this.immersiveCanvas.setAttribute('style', '');
        this.immersiveCanvasInjectedInDOM = false;
      }
  
      this.immersiveCanvas = canvas;
  
      if (this.immersiveCanvas) {
        if (!TEST_ENV && !this.global.document.body.contains(this.immersiveCanvas)) {
          this.immersiveCanvasInjectedInDOM = true;
          applyCanvasStylesForMinimalRendering(this.immersiveCanvas);
          this.global.document.body.appendChild(this.immersiveCanvas);
        }
      }
    }

  }
}
