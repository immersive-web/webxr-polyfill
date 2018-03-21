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

import EventTarget from '../../src/lib/EventTarget';

class ChildTarget extends EventTarget {}

describe('API - EventTarget', () => {
  it('binds events via addEventListener', () => {
    const c = new ChildTarget();
    const events = [];
    c.addEventListener('click', ({ value }) => events.push(`${value}-1`));
    c.addEventListener('click', ({ value }) => events.push(`${value}-2`));
    c.addEventListener('scroll', ({ value }) => events.push(value));

    c.dispatchEvent('click', { value: 'hello' });
    assert.deepEqual(events, ['hello-1', 'hello-2']);

    c.dispatchEvent('scroll', { value: 'hello' });
    assert.deepEqual(events, ['hello-1', 'hello-2', 'hello']);
  });

  it('removes events via removeEventListener', () => {
    const c = new ChildTarget();
    const events = [];
    const c1 = ({ value }) => events.push(`${value}-1`);
    const c2 = ({ value }) => events.push(`${value}-2`);
    c.addEventListener('click', c1);
    c.addEventListener('click', c2);

    c.dispatchEvent('click', { value: 'hello' });
    assert.deepEqual(events, ['hello-1', 'hello-2']);

    c.removeEventListener('click', c2);
    c.dispatchEvent('click', { value: 'world' });
    assert.deepEqual(events, ['hello-1', 'hello-2', 'world-1']);

    c.removeEventListener('click', c1);
    c.dispatchEvent('click', { value: 'hello' });
    assert.deepEqual(events, ['hello-1', 'hello-2', 'world-1']);
  });

  it('fires handlers stored as `on${type}` attributes', () => {
    const c = new ChildTarget();
    const events = [];
    const c1 = ({ value }) => events.push(`${value}-1`);
    const c2 = ({ value }) => events.push(`${value}-2`);
    c.addEventListener('click', c1);
    c.onclick = c2;

    c.dispatchEvent('click', { value: 'hello' });
    assert.deepEqual(events, ['hello-1', 'hello-2']);
  });
});
