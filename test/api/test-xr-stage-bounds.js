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

import mocha from 'mocha';
import { assert } from 'chai';

import XRStageBounds, { PRIVATE } from '../../src/api/XRStageBounds';
import XRStageBoundsPoint from '../../src/api/XRStageBoundsPoint';

describe('API - XRStageBounds', () => {
  it('exposes a PRIVATE named export', () => {
    const bounds = new XRStageBounds([-2, -3, 2, -3, 2,  3, -2,  3]);
    assert.ok(bounds[PRIVATE]);
  });

  it('can be constructed interally with an array of X and Z values', () => {
    const bounds = new XRStageBounds([
      -2, -3,
       2, -3,
       2,  3,
      -2,  3
    ]);

    for (let i = 0; i < bounds.geometry.length; i++) {
      const point = bounds.geometry[i];
      assert.instanceOf(point, XRStageBoundsPoint);
      assert.equal(point.x, (i === 0 || i === 3) ? -2 : 2);
      assert.equal(point.z, i < 2 ? -3 : 3);
    }
  });
});
