const mock = require('mock-require');

/**
 * Mock the `cardboard-vr-display` dependency since it uses
 * globals which makes it difficult to test against.
 */
mock('cardboard-vr-display', './lib/MockVRDisplay');
