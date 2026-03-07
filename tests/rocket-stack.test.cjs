const test = require("node:test");
const assert = require("node:assert/strict");
const { loadK2D } = require("./helpers/load-k2d.cjs");

const K2D = loadK2D(["src/js/constants.js", "src/js/rocket-stack.js"]);
const { RocketStack } = K2D;

function buildBasicStack(stack, anchorX = 300, anchorY = 400) {
  const engineTarget = stack.getSnapTargets(anchorX, anchorY, "engine")[0];
  assert.ok(engineTarget);
  assert.equal(stack.placePartOnTarget("engine", engineTarget), true);

  const tankTarget = stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0];
  assert.ok(tankTarget);
  assert.equal(stack.placePartOnTarget("fuel_tank", tankTarget), true);
}

test("core placement rules enforce engine-first and no engine-above", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  assert.equal(stack.canPlacePart("fuel_tank"), false);
  assert.equal(stack.canPlacePart("nosecone"), false);
  assert.equal(stack.canPlacePart("engine"), true);

  const engineTarget = stack.getSnapTargets(anchorX, anchorY, "engine")[0];
  assert.equal(stack.placePartOnTarget("engine", engineTarget), true);
  assert.equal(stack.canPlacePart("engine"), false);
  assert.equal(stack.canPlacePart("fuel_tank"), true);
});

test("booster placement requires a fuel tank side slot", () => {
  const stack = new RocketStack();
  const anchorX = 320;
  const anchorY = 440;

  assert.equal(stack.canPlacePart("booster"), false);
  buildBasicStack(stack, anchorX, anchorY);
  assert.equal(stack.canPlacePart("booster"), true);

  const slots = stack.getSnapTargets(anchorX, anchorY, "booster");
  assert.equal(slots.length, 2);
  assert.equal(stack.placePartOnTarget("booster", slots[0]), true);
  assert.equal(stack.getSnapTargets(anchorX, anchorY, "booster").length, 1);
});

test("deleting a core part is blocked when boosters are attached to it", () => {
  const stack = new RocketStack();
  const anchorX = 280;
  const anchorY = 430;

  buildBasicStack(stack, anchorX, anchorY);
  const slot = stack.getSnapTargets(anchorX, anchorY, "booster")[0];
  assert.equal(stack.placePartOnTarget("booster", slot), true);

  // fuel tank is index 1 in [engine, fuel_tank]
  assert.equal(stack.canDeletePart({ kind: "core", index: 1 }), false);
  assert.equal(stack.deletePart({ kind: "core", index: 1 }), false);
});

test("reorder rules block moving anchored core part and allow valid reorder", () => {
  const stack = new RocketStack();
  const anchorX = 340;
  const anchorY = 450;

  buildBasicStack(stack, anchorX, anchorY);
  const secondTankTarget = stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0];
  assert.equal(stack.placePartOnTarget("fuel_tank", secondTankTarget), true);
  const noseTarget = stack.getSnapTargets(anchorX, anchorY, "nosecone")[0];
  assert.equal(stack.placePartOnTarget("nosecone", noseTarget), true);

  assert.equal(stack.canReorderCorePart(3, 2), false);
  assert.equal(stack.reorderCorePart(3, 2), false);

  const slot = stack.getSnapTargets(anchorX, anchorY, "booster")[0];
  assert.equal(stack.placePartOnTarget("booster", slot), true);
  assert.equal(stack.canReorderCorePart(1, 2), false);

  assert.equal(stack.deletePart({ kind: "booster", index: 0 }), true);
  assert.equal(stack.canReorderCorePart(1, 2), true);
  assert.equal(stack.reorderCorePart(1, 2), true);
  assert.equal(stack.getCoreTypes().join(","), "engine,fuel_tank,fuel_tank,nosecone");
});

test("main fuel capacity is based on tanks only, not boosters", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  buildBasicStack(stack, anchorX, anchorY);
  const baseCapacity = stack.getFuelCapacity();
  assert.equal(baseCapacity, 75);

  const slot = stack.getSnapTargets(anchorX, anchorY, "booster")[0];
  assert.equal(stack.placePartOnTarget("booster", slot), true);
  assert.equal(stack.getFuelCapacity(), baseCapacity);
});
