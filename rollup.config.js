/*
 * Copyright 2016 Google Inc. All Rights Reserved.
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

import fs from 'fs';
import path from 'path';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
import babel from 'rollup-plugin-babel';
const banner = fs.readFileSync(path.join(__dirname, 'licenses.txt'));

export default {
  input: 'src/index.js',
  output: {
    file: './build/webxr-polyfill.js',
    format: 'umd',
    name: 'WebXRPolyfill',
    banner: banner,
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    babel({
      include: [
        'src/**',
        'node_modules/gl-matrix/**'
      ]
    }),
    resolve(),
    commonjs(),
    cleanup({
      comments: 'none',
    }),
  ],
};
