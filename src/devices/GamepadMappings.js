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

let daydream = {
  mapping: '',
  profiles: ['daydream', 'generic-trigger-touchpad'],
  buttons: {
    length: 3,
    0: null,
    1: null,
    2: 0
  },
};

let oculusGo = {
  mapping: 'xr-standard',
  profiles: ['oculus-go', 'generic-trigger-touchpad'],
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
    'Oculus Quest': ['oculus-touch-s', 'oculus-touch', 'generic-trigger-squeeze-thumbstick']
  },
  profiles: ['oculus-touch', 'generic-trigger-squeeze-thumbstick'],
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
  profiles: ['openvr-controller', 'generic-trigger-squeeze-touchpad'],
  displayProfiles: {
    'HTC Vive': ['htc-vive', 'generic-trigger-squeeze-touchpad'],
    'HTC Vive DVT': ['htc-vive', 'generic-trigger-squeeze-touchpad'],
    'Valve Index': ['valve-index', 'generic-trigger-squeeze-touchpad-thumbstick']
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

let samsungGearVR = {
  mapping: 'xr-standard',
  profiles: ['samsung-gearvr', 'generic-trigger-touchpad'],
  buttons: {
    length: 3,
    0: 1,
    1: null,
    2: 0
  },
  gripTransform: {
    orientation: [Math.PI * 0.11, 0, 0, 1]
  }
};

let samsungOdyssey = {
  mapping: 'xr-standard',
  profiles: ['samsung-odyssey', 'microsoft-mixed-reality', 'generic-trigger-squeeze-touchpad-thumbstick'],
  buttons: {
    length: 4,
    0: 1, // index finger trigger
    1: 0, // pressable joystick
    2: 2, // grip trigger
    3: 4, // pressable touchpad
  },
  // Grip adjustments determined experimentally.
  gripTransform: {
    position: [0, -0.02, 0.04, 1],
    orientation: [Math.PI * 0.11, 0, 0, 1]
  }
};

let windowsMixedReality = {
  mapping: 'xr-standard',
  profiles: ['microsoft-mixed-reality', 'generic-trigger-squeeze-touchpad-thumbstick'],
  buttons: {
    length: 4,
    0: 1, // index finger trigger
    1: 0, // pressable joystick
    2: 2, // grip trigger
    3: 4, // pressable touchpad
  },
  // Grip adjustments determined experimentally.
  gripTransform: {
    position: [0, -0.02, 0.04, 1],
    orientation: [Math.PI * 0.11, 0, 0, 1]
  }
};

let GamepadMappings = {
  'Daydream Controller': daydream,
  'Gear VR Controller': samsungGearVR,
  'Oculus Go Controller': oculusGo,
  'Oculus Touch (Right)': oculusTouch,
  'Oculus Touch (Left)': oculusTouch,
  'OpenVR Gamepad': openVr,
  'Spatial Controller (Spatial Interaction Source) 045E-065A': windowsMixedReality,
  'Spatial Controller (Spatial Interaction Source) 045E-065D': samsungOdyssey,
  'Windows Mixed Reality (Right)': windowsMixedReality,
  'Windows Mixed Reality (Left)': windowsMixedReality,
};

export default GamepadMappings;