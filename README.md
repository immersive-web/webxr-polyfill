# WebXR Polyfill

[![Build Status](http://img.shields.io/travis/immersive-web/webxr-polyfill.svg?style=flat-square)](https://travis-ci.org/immersive-web/webxr-polyfill)
[![Build Status](http://img.shields.io/npm/v/webxr-polyfill.svg?style=flat-square)](https://www.npmjs.org/package/webxr-polyfill)

A JavaScript implementation of the [WebXR Device API][webxr-spec]. This polyfill allows developers to write against the latest specification, providing support when run on browsers that implement the [WebVR 1.1 spec][webvr-spec], or no WebVR/WebXR support at all.

:warning: **The WebXR Device API is still in flux** :warning:

The polyfill will be updated to track changes in the spec, and may introduce breaking changes in the polyfill's `1.0.x` releases until the spec stabilizes.

---

If you are writing code against the [WebVR 1.1 spec][webvr-spec], use [webvr-polyfill], which supports browsers with the 1.0 spec, or no implementation at all. It is recommended to write your code targeting the [WebXR Device API spec][webxr-spec] however and use this polyfill as browsers begin to implement the latest changes.

Input will be added in the future. ([immersive-web/webxr#325](https://github.com/immersive-web/webxr/pull/325)).

## Setup

### Installing

Download the build at [build/webxr-polyfill.js](build/webxr-polyfill.js) and include it as a script tag,
or use a CDN. You can also use the minified file in the same location as `webxr-polyfill.min.js`.

```html
  <script src='webxr-polyfill.js'></script>
  <!-- or use a link to a CDN -->
  <script src='https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js'></script>
```

Or if you're using a build tool like [browserify] or [webpack], install it via [npm].

```
$ npm install --save webxr-polyfill
```

### Using

The webxr-polyfill exposes a single constructor, `WebXRPolyfill` that takes an
object for configuration. See full configuration options at [API](#api).

Be sure to instantiate the polyfill before calling any of your XR code! The
polyfill needs to patch the API if it does not exist so your content code can
assume that the WebXR API will just work.

If using script tags, a `WebXRPolyfill` global constructor will exist.

```js
var polyfill = new WebXRPolyfill();
```

In a modular ES6 world, import and instantiate the constructor similarly.

```js
import WebXRPolyfill from 'webxr-polyfill';
const polyfill = new WebXRPolyfill();
```

## API

### new WebXRPolyfill(global, config)

Takes a `global` object (usually `window`), as well as a `config` object with
the following options:

* `webvr`: Whether or not there should be an attempt to fall back to a
  WebVR 1.1 VRDisplay. (default: `true`).
* `cardboard`: Whether or not there should be an attempt to fall back to a
  JavaScript implementation of the WebXR API only on mobile. (default: `true`)

## Browser Support

There are 3 builds provided: [build/webxr-polyfill.js](build/webxr-polyfill.js), an ES5 transpiled build, its minified counterpart [build/webxr-polyfill.min.js](build/webxr-polyfill.min.js), and an untranspiled [ES Modules] version [build/webxr-polyfill.module.js](build/webxr-polyfill.module.js). If using the transpiled ES5 build, its up to developers to decide which browser features to polyfill based on their support, as no extra polyfills are included. Some browser features this library uses include:

* TypedArrays
* Object.assign
* Promise
* Symbol
* Map
* Array#includes

Check the [.babelrc](.babelrc) configuration and ensure the polyfill runs in whatever browsers you choose to support.

## Polyfilling Rules

* If `'xr' in navigator === false`:
  * WebXR classes (e.g. `XRDevice`, `XRSession`) will be added to the global
  * `navigator.xr` will be polyfilled.
  * If the platform has a `VRDisplay` from the [WebVR 1.1 spec][webvr-spec] available:
    * `navigator.xr.requestDevice()` will return a polyfilled `XRDevice` wrapping the `VRDisplay`.
  * If the platform does not have a `VRDisplay`, `config.cardboard === true`, and on mobile:
    * `navigator.xr.requestDevice()` will return a polyfilled `XRDevice` based on [CardboardVRDisplay].
  * If `WebGLRenderingContext.prototype.setCompatibleXRDevice` is not a function:
    * Polyfill all `WebGLRenderingContext.prototype.setCompatibleXRDevice` and a creation attribute
for `{ compatibleXrDevice }`.
    * Polyfills `HTMLCanvasElement.prototype.getContext` to support a `xrpresent` type. Returns a polyfilled `XRPresentationContext` used for mirroring and magic window.
* If `'xr' in navigator === true`, `config.cardboard === true` and on mobile:
  * Overwrite `navigator.xr.requestDevice` so that a native `XRDevice` is returned if it exists, and if not, return a polyfilled `XRDevice` based on [CardboardVRDisplay].

In the future, when the WebXR API is implemented on a platform but inconsistent with spec (due to new spec changes or inconsistencies), the polyfill will attempt to patch these differences without overwriting the native behavior.

## Not supported/Caveats

* A lot of objects should only be used in the frame they were retrieved; don't save and access a XRDevice's `poseModelMatrix` in a frame other than when it was created.
* `XRWebGLLayer.multiview`
* `XRWebGLLayer.framebufferScaleFactor` and `XRWebGLLayer.requestViewportScaling()`

## License

This program is free software for both commercial and non-commercial use,
distributed under the [Apache 2.0 License](LICENSE).

[webxr-spec]: https://immersive-web.github.io/webxr/spec/latest/
[webvr-spec]: https://immersive-web.github.io/webvr/spec/1.1/
[webvr-polyfill]: https://github.com/immersive-web/webvr-polyfill
[npm]: https://www.npmjs.com
[browserify]: http://browserify.org/
[webpack]: https://webpack.github.io/
[ES Modules]: https://jakearchibald.com/2017/es-modules-in-browsers/
[CardboardVRDisplay]: https://immersive-web.github.io/cardboard-vr-display
