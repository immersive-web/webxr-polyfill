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

/**
 * index.js is used as an entry point for building a rollup bundle
 * form of the polyfill in UMD style.
 */

// Do not use any polyfills for the time being; let the consumers
// decide which features to support
// import 'babel-polyfill';
import WebXRPolyfill from './WebXRPolyfill';

export default WebXRPolyfill;
