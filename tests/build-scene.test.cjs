const test = require("node:test");
const assert = require("node:assert/strict");
const { loadK2D } = require("./helpers/load-k2d.cjs");

const K2D = loadK2D(["src/js/constants.js", "src/js/launch-pad.js", "src/js/build-scene.js"]);
const { BuildScene } = K2D;

test("build scene creates exactly four cloud layers with expected styles and counts", () => {
  const scene = new BuildScene();
  scene.ensureWorldLayout(1200, 800);

  assert.equal(scene.cloudLayers.length, 4);
  assert.equal(scene.cloudLayers.map((layer) => layer.style).join(","), "bulky-flat,puffy-light,wispy,wispy-streak");
  assert.equal(scene.cloudLayers.map((layer) => layer.clouds.length).join(","), "16,10,6,4");
});

test("cloud layers are distributed in ascending altitude bands at 1/5 increments", () => {
  const scene = new BuildScene();
  scene.ensureWorldLayout(1200, 800);

  const means = scene.cloudLayers.map((layer) => {
    const total = layer.clouds.reduce((sum, cloud) => sum + cloud.y, 0);
    return total / layer.clouds.length;
  });

  // Higher altitude means lower world Y; each layer should be well above the one below.
  assert.ok(means[0] > means[1]);
  assert.ok(means[1] > means[2]);
  assert.ok(means[2] > means[3]);

  // Rough spacing check tied to 1/5 transition step (1000 for default 5000 transition).
  const d01 = Math.abs(means[0] - means[1]);
  const d12 = Math.abs(means[1] - means[2]);
  const d23 = Math.abs(means[2] - means[3]);
  assert.ok(d01 > 500);
  assert.ok(d12 > 500);
  assert.ok(d23 > 500);
});

test("drawClouds cleanly partitions back and front cloud passes", () => {
  const scene = new BuildScene();
  scene.ensureWorldLayout(1200, 800);

  let backCount = 0;
  let frontCount = 0;
  const totalClouds = scene.cloudLayers.reduce((sum, layer) => sum + layer.clouds.length, 0);
  const ctx = {};

  scene.drawCloudShape = () => {
    if (scene._drawPass === "back") {
      backCount += 1;
    }
    if (scene._drawPass === "front") {
      frontCount += 1;
    }
  };

  scene._drawPass = "back";
  scene.drawClouds(ctx, false);
  scene._drawPass = "front";
  scene.drawClouds(ctx, true);
  scene._drawPass = null;

  assert.equal(backCount + frontCount, totalClouds);
  assert.ok(backCount > 0);
  assert.ok(frontCount > 0);
});
