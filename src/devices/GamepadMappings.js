/*
 * Copyright 2019 Immersive Web Community Group. All Rights Reserved.
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

/*
Example Gamepad mapping. Any of the values may be omitted for the original
gamepad values to pass through unchanged.

"Gamepad ID String": { // The Gamepad.id that this entry maps to.
  mapping: 'xr-standard', // Overrides the Gamepad.mapping that is reported
  profiles: ['gamepad-id-string'], // The profiles array that should be reported
  displayProfiles: {
    // Alternative profiles arrays to report if the VRDevice.displayName matches
    "WebVR Display Name": ['gamepad-id-string']
  },
  axes: { // Remaps the reported axes
    length: 2, // Overrides the length of the reported axes array
    invert: [0] // List of mapped axes who's value should be inverted
    0: 2, // Remaps axes[0] to report axis[2] from the original gamepad object
    1: null, // Remaps axes[1] to a placeholder axis (always reports 0)
  },
  buttons: { // Remaps the reported buttons
    length: 2, // Overrides the length of the reported buttons array
    0: 2, // Remaps buttons[0] to report buttons[2] from the original gamepad object
    1: null // Remaps buttons[1] to a placeholder button (always reports 0/false)
  },
  gripTransform: { // An additional transform to apply to the gripSpace's pose
    position: [0, 0, 0.5], // Additional translation vector to apply
    orientation: [0, 0, 0, 1] // Additional rotation quaternion to apply
  },
  targetRayTransform: { // An additional transform to apply to the targetRaySpace's pose
    position: [0, 0, 0.5], // Additional translation vector to apply
    orientation: [0, 0, 0, 1] // Additional rotation quaternion to apply
  }
}
*/

let oculusGo = {
  mapping: 'xr-standard',
  profiles: ['oculus-go', 'touchpad-controller'],
  buttons: {
    length: 3,
    0: 1,
    1: null,
    2: 0
  },
  // Grip adjustments determined experimentally.
  gripTransform: {
    orientation: [Math.PI * 0.11, 0, 0, 1]
  }
};

// Applies to both left and right Oculus Touch controllers.
let oculusTouch = {
  mapping: 'xr-standard',
  displayProfiles: {
    'Oculus Quest': ['oculus-quest', 'oculus-touch', 'thumbstick-controller']
  },
  profiles: ['oculus-touch', 'thumbstick-controller'],
  axes: {
    length: 4,
    0: null,
    1: null,
    2: 0,
    3: 1
  },
  buttons: {
    length: 6,
    0: 1,
    1: 2,
    2: null,
    3: 0,
    4: 3,
    5: 4
  },
  // Grip adjustments determined experimentally.
  gripTransform: {
    position: [0, -0.02, 0.04, 1],
    orientation: [Math.PI * 0.11, 0, 0, 1]
  }
};

let openVr = {
  mapping: 'xr-standard',
  profiles: ['openvr-controller', 'touchpad-controller'],
  displayProfiles: {
    'HTC Vive': ['htc-vive', 'touchpad-controller'],
    'HTC Vive DVT': ['htc-vive', 'touchpad-controller']
  },
  buttons: {
    length: 3,
    0: 1,
    1: 2,
    2: 0
  },
  // Transform adjustments determined experimentally.
  gripTransform: {
    position: [0, 0, 0.05, 1],
  },
  targetRayTransform: {
    orientation: [Math.PI * -0.08, 0, 0, 1]
  }
};

let windowsMixedReality = {
  mapping: 'xr-standard',
  profiles: ['microsoft-045e-065d', 'windows-mixed-reality', 'touchpad-thumbstick-controller'],
  buttons: {
    length: 4,
    0: 1, // index finger trigger
    1: 0, // grip trigger
    2: 2, // pressable touchpad
    3: 4, // pressable joystick
  },
  // Grip adjustments determined experimentally.
  gripTransform: {
    position: [0, -0.02, 0.04, 1],
    orientation: [Math.PI * 0.11, 0, 0, 1]
  }
};

let GamepadMappings = {
  'Oculus Go Controller': oculusGo,
  'Oculus Touch (Right)': oculusTouch,
  'Oculus Touch (Left)': oculusTouch,
  'OpenVR Gamepad': openVr,
  'Windows Mixed Reality (Right)': windowsMixedReality,
  'Windows Mixed Reality (Left)': windowsMixedReality,
  'Spatial Controller (Spatial Interaction Source) 045E-065D': windowsMixedReality
};

export default GamepadMappings;