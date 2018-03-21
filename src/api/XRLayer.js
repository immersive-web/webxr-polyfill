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

export default class XRLayer {
  constructor() {}

  /**
   * @TODO No mention in spec on not reusing the XRViewport
   * on every frame
   *
   * @param {XRView} view
   * @return {XRViewport?}
   */
  getViewport(view) {
    // TODO In the future maybe all this logic should be handled
    // by the XRLayer? It's a bit difficult as this is one of the few
    // classes directly instantiated by content rather.
    return view._getViewport(this);
  }
}
