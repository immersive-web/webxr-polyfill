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

import XRCoordinateSystem from './XRCoordinateSystem';
import * as mat4 from 'gl-matrix/src/gl-matrix/mat4';

const DEFAULT_EMULATION_HEIGHT = 1.6;

export const PRIVATE = Symbol('@@webxr-polyfill/XRFrameOfReference');

export const XRFrameOfReferenceTypes = ['head-model', 'eye-level', 'stage'];

export const XRFrameOfReferenceOptions = Object.freeze({
  disableStageEmulation: false,
  stageEmulationHeight: 0,
});

export default class XRFrameOfReference extends XRCoordinateSystem {
  /**
   * Optionally takes a `transform` from a polyfill's requestFrameOfReferenceMatrix
   * so polyfill's can provide their own transforms for stage (or if they
   * wanted to override eye-level/head-model).
   *
   * @param {PolyfilledXRDevice} polyfill
   * @param {XRFrameOfReferenceType} type
   * @param {XRFrameOfReferenceOptions} options
   * @param {Float32Array?} transform
   * @param {?} bounds
   */
  constructor(polyfill, type, options, transform, bounds) {
    options = Object.assign({}, XRFrameOfReferenceOptions, options);

    if (!XRFrameOfReferenceTypes.includes(type)) {
      throw new Error(`XRFrameOfReferenceType must be one of ${XRFrameOfReferenceTypes}`);
    }

    super();

    // If stage emulation is disabled, and this is a stage frame of reference,
    // and the PolyfilledXRDevice did not provide a transform, this is an invalid
    // configuration and we shouldn't emulate here. XRSession.requestFrameOfReference
    // should check this as well.
    if (type === 'stage' && options.disableStageEmulation && !transform) {
      throw new Error(`XRFrameOfReference cannot use 'stage' type, if disabling emulation and platform does not provide`);
    }

    const { disableStageEmulation, stageEmulationHeight } = options;

    let emulatedHeight = 0;
    // If we're using stage reference and no transform, we're emulating.
    // Set emulated height from option or use the default
    if (type === 'stage' && !transform) {
      emulatedHeight = stageEmulationHeight !== 0 ? stageEmulationHeight : DEFAULT_EMULATION_HEIGHT;
    }

    // If we're emulating the stage, and the polyfill did not provide
    // a transform, create one here
    if (type === 'stage' && !transform) {
      // Apply emulatedHeight to the `y` translation
      transform = mat4.identity(new Float32Array(16));
      transform[13] = emulatedHeight;
    }

    this[PRIVATE] = {
      disableStageEmulation,
      stageEmulationHeight,
      emulatedHeight,
      type,
      transform,
      polyfill,
      bounds,
    };
    this.onboundschange = undefined;
  }

  /**
   * @return {XRStageBounds?}
   */
  get bounds() { return this[PRIVATE].bounds; }

  /**
   * @return {number}
   */
  get emulatedHeight() { return this[PRIVATE].emulatedHeight; }

  /**
   * NON-STANDARD
   *
   * @return {XRFrameOfReferenceType}
   */
  get type() { return this[PRIVATE].type; }

  /**
   * NON-STANDARD
   * Takes a base pose model matrix and transforms it by the
   * frame of reference.
   *
   * @param {Float32Array} out
   * @param {Float32Array} pose
   */
  transformBasePoseMatrix(out, pose) {
    // If we have a transform, it was provided by the polyfill
    // (probably "stage" type, but a polyfill could provide its own head-model)
    // or we could be emulating a stage, in which case a transform
    // was created in the constructor. Either way, if we have a transform, use it.
    if (this[PRIVATE].transform) {
      mat4.multiply(out, this[PRIVATE].transform, pose);
      return;
    }

    switch (this.type) {
      // For 'head-model' just strip out the translation
      case 'head-model':
        if (out !== pose) {
          mat4.copy(out, pose);
        }

        out[12] = out[13] = out[14] = 0;
        return;

      // For 'eye-level', assume the pose given as eye level,
      // so no transformation
      case 'eye-level':
        if (out !== pose) {
          mat4.copy(out, pose);
        }

        return;
    }
  }

  /**
   * NON-STANDARD
   * Takes a base view matrix and transforms it by the
   * pose matrix frame of reference.
   *
   * @param {Float32Array} out
   * @param {Float32Array} view
   */
  transformBaseViewMatrix(out, view) {
    // If we have a transform (native or emulated stage),
    // use it
    let frameOfRef = this[PRIVATE].transform;

    if (frameOfRef) {
      mat4.invert(out, frameOfRef);
      mat4.multiply(out, view, out);
    }
    // If we have a head model, invert the view matrix
    // to strip the translation and invert it back to a
    // view matrix
    else if (this.type === 'head-model') {
      mat4.invert(out, view);
      out[12] = 0;
      out[13] = 0;
      out[14] = 0;
      mat4.invert(out, out);
      return out;
    }
    // Otherwise don't transform the view matrix at all
    // (like for `eye-level` frame of references.
    else {
      mat4.copy(out, view);
    }

    return out;
  }
}
