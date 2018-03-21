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

import EventTarget from '../lib/EventTarget';
import XRSession, { XRSessionCreationOptions, validateSessionOptions } from './XRSession';

const PRIVATE = Symbol('@@webxr-polyfill/XRDevice');

export default class XRDevice extends EventTarget {
  /**
   * Pass in an instance of a PolyfilledXRDevice which exposes
   * an interface that provides platform specific code, backed
   * by Cardboard, Native 1.1 HMD, etc.
   *
   * @see ./src/devices/PolyfilledXRDevice.js
   *
   * @param {PolyfilledXRDevice} polyfill
   */
  constructor(polyfill) {
    if (!polyfill) {
      throw new Error('XRDevice must receive a PolyfilledXRDevice.');
    }

    super();

    if (process.env.NODE_ENV === 'test') {
      this.polyfill = polyfill;
    }

    this[PRIVATE] = {
      polyfill,
      exclusiveSession: null,
      nonExclusiveSessions: new Set(),
    }

    this.ondeactive = undefined;
  }

  /**
   * @param {XRSessionCreationOptions} sessionOptions
   * @return {Promise<null>}
   */
  async supportsSession(sessionOptions={}) {
    sessionOptions = Object.assign({}, XRSessionCreationOptions, sessionOptions);
    if (!validateSessionOptions(sessionOptions)) {
      return Promise.reject(null);
    }

    if (!this[PRIVATE].polyfill.supportsSession(sessionOptions)) {
      return Promise.reject(null);
    };

    return null;
  }

  /**
   * @param {XRSessionCreationOptions} sessionOptions
   * @return {Promise<XRSession>}
   */
  async requestSession(sessionOptions) {
    sessionOptions = Object.assign({}, XRSessionCreationOptions, sessionOptions);
    if (!validateSessionOptions(sessionOptions)) {
      throw new Error('NotSupportedError');
    }

    if (this[PRIVATE].exclusiveSession && sessionOptions.exclusive) {
      throw new Error('InvalidStateError');
    }

    // Call polyfill's requestSession, which validates the sessionOptions
    // and does some initialization (1.1 fallback calls `vrDisplay.requestPresent()`
    // for example). Could throw due to missing user gesture.
    const sessionId = await this[PRIVATE].polyfill.requestSession(sessionOptions);
    const session = new XRSession(this[PRIVATE].polyfill, this, sessionOptions, sessionId);

    if (sessionOptions.exclusive) {
      this[PRIVATE].exclusiveSession = session;
    } else {
      this[PRIVATE].nonExclusiveSessions.add(session);
    }

    const onSessionEnd = () => {
      if (session.exclusive) {
        this[PRIVATE].exclusiveSession = null;
      } else {
        this[PRIVATE].nonExclusiveSessions.delete(session);
      }
      session.removeEventListener('end', onSessionEnd);
    };
    session.addEventListener('end', onSessionEnd);

    return session;
  }
}
