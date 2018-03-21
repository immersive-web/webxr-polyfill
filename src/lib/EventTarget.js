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

const PRIVATE = Symbol('@@webxr-polyfill/EventTarget');

export default class EventTarget {
  constructor() {
    this[PRIVATE] = {
      listeners: new Map(),
    };
  }

  /**
   * @param {string} type
   * @param {Function} listener
   */
  addEventListener(type, listener) {
    if (typeof type !== 'string') { throw new Error('`type` must be a string'); }
    if (typeof listener !== 'function') { throw new Error('`listener` must be a function'); }

    const typedListeners = this[PRIVATE].listeners.get(type) || [];
    typedListeners.push(listener);
    this[PRIVATE].listeners.set(type, typedListeners);
  }

  /**
   * @param {string} type
   * @param {Function} listener
   */
  removeEventListener(type, listener) {
    if (typeof type !== 'string') { throw new Error('`type` must be a string'); }
    if (typeof listener !== 'function') { throw new Error('`listener` must be a function'); }

    const typedListeners = this[PRIVATE].listeners.get(type) || [];

    for (let i = typedListeners.length; i >= 0; i--) {
      if (typedListeners[i] === listener) {
        typedListeners.pop();
      }
    }
  }

  /**
   * @param {string} type
   * @param {object} event
   */
  dispatchEvent(type, event) {
    const typedListeners = this[PRIVATE].listeners.get(type) || [];

    // Copy over all the listeners because a callback could remove
    // an event listener, preventing all listeners from firing when
    // the event was first dispatched.
    const queue = [];
    for (let i = 0; i < typedListeners.length; i++) {
      queue[i] = typedListeners[i];
    }

    for (let listener of queue) {
      listener(event);
    }

    // Also fire if this EventTarget has an `on${EVENT_TYPE}` property
    // that's a function
    if (typeof this[`on${type}`] === 'function') {
      this[`on${type}`](event);
    }
  }
}
