/*
 * Copyright 2018 Google Inc. All Rights Reserved.
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

export const PRIVATE = Symbol('@@webxr-polyfill/XRInputSourcesChangeEvent');

export default class XRInputSourcesChangeEvent extends Event {
  /**
   * @param {string} type
   * @param {Object} eventInitDict
   */
  constructor(type, eventInitDict) {
    super(type, eventInitDict);
    this[PRIVATE] = {
      session: eventInitDict.session,
      added: eventInitDict.added,
      removed: eventInitDict.removed
    };
    // safari bug:  super() seems to return object of type Event, with Event as prototype
    Object.setPrototypeOf(this, XRInputSourcesChangeEvent.prototype);
  }

  /**
   * @return {XRSession}
   */
  get session() { return this[PRIVATE].session; }

  /**
   * @return {Array<XRInputSource>}
   */
  get added() { return this[PRIVATE].added; }

  /**
   * @return {Array<XRInputSource>}
   */
  get removed() { return this[PRIVATE].removed; }
}