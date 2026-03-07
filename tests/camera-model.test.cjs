const test = require("node:test");
const assert = require("node:assert/strict");
const { loadK2D } = require("./helpers/load-k2d.cjs");

const K2D = loadK2D(["src/js/camera-model.js"]);
const { CameraModel } = K2D;

test("flight camera always follows rocket horizontally", () => {
  const cam = CameraModel.computeFlightCamera(
    { x: 0, y: 0 },
    { x: 850, y: 280 },
    { width: 1000, height: 600 }
  );

  assert.equal(cam.x, 850 - 520);
});

test("flight camera does not move vertically while rocket is below mid-screen", () => {
  const cam = CameraModel.computeFlightCamera(
    { x: 0, y: 0 },
    { x: 500, y: 340 },
    { width: 1000, height: 600 }
  );

  assert.equal(cam.y, 0);
});

test("flight camera follows upward once rocket crosses mid-screen", () => {
  const cam = CameraModel.computeFlightCamera(
    { x: 0, y: 0 },
    { x: 500, y: 120 },
    { width: 1000, height: 600 }
  );

  assert.ok(cam.y < 0);
});
