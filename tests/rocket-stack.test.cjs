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

test("core placement rules enforce engine-first and require stage separator before upper engines", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  assert.equal(stack.canPlacePart("fuel_tank"), false);
  assert.equal(stack.canPlacePart("stage_separator"), false);
  assert.equal(stack.canPlacePart("nosecone"), false);
  assert.equal(stack.canPlacePart("engine"), true);

  const engineTarget = stack.getSnapTargets(anchorX, anchorY, "engine")[0];
  assert.equal(stack.placePartOnTarget("engine", engineTarget), true);
  assert.equal(stack.canPlacePart("engine"), false);
  assert.equal(stack.canPlacePart("fuel_tank"), true);

  const tankTarget = stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0];
  assert.equal(stack.placePartOnTarget("fuel_tank", tankTarget), true);
  assert.equal(stack.canPlacePart("engine"), false);
  assert.equal(stack.canPlacePart("stage_separator"), true);

  const stageTarget = stack.getSnapTargets(anchorX, anchorY, "stage_separator")[0];
  assert.equal(stack.placePartOnTarget("stage_separator", stageTarget), true);
  assert.equal(stack.canPlacePart("engine"), true);

  const upperEngineTarget = stack.getSnapTargets(anchorX, anchorY, "engine")[0];
  assert.equal(stack.placePartOnTarget("engine", upperEngineTarget), true);
  assert.equal(stack.getCoreTypes().join(","), "engine,fuel_tank,stage_separator,engine");
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

test("launch readiness blocks unfinished top stage separator", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  const engineTarget = stack.getSnapTargets(anchorX, anchorY, "engine")[0];
  assert.equal(stack.placePartOnTarget("engine", engineTarget), true);
  const tankTarget = stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0];
  assert.equal(stack.placePartOnTarget("fuel_tank", tankTarget), true);
  const stageTarget = stack.getSnapTargets(anchorX, anchorY, "stage_separator")[0];
  assert.equal(stack.placePartOnTarget("stage_separator", stageTarget), true);

  assert.equal(stack.isLaunchReady(), false);
  const upperEngineTarget = stack.getSnapTargets(anchorX, anchorY, "engine")[0];
  assert.equal(stack.placePartOnTarget("engine", upperEngineTarget), true);
  assert.equal(stack.isLaunchReady(), true);
});

test("vessel rects and nozzles can exclude boosters for post-staging draw", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  buildBasicStack(stack, anchorX, anchorY);
  const slot = stack.getSnapTargets(anchorX, anchorY, "booster")[0];
  assert.equal(stack.placePartOnTarget("booster", slot), true);

  const fullRects = stack.getVesselPartRects();
  const stagedRects = stack.getVesselPartRects({ includeBoosters: false });
  assert.ok(fullRects.some((rect) => rect.type === "booster"));
  assert.ok(stagedRects.every((rect) => rect.type !== "booster"));

  const fullNozzles = stack.getEngineNozzles();
  const stagedNozzles = stack.getEngineNozzles({ includeBoosters: false });
  assert.ok(fullNozzles.some((nozzle) => nozzle.kind === "booster"));
  assert.ok(stagedNozzles.every((nozzle) => nozzle.kind === "main"));
});

test("part stage can be assigned in build data model", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  buildBasicStack(stack, anchorX, anchorY);
  const slot = stack.getSnapTargets(anchorX, anchorY, "booster")[0];
  assert.equal(stack.placePartOnTarget("booster", slot), true);

  assert.equal(stack.getPartStage({ kind: "core", index: 0 }), 1);
  assert.equal(stack.setPartStage({ kind: "core", index: 0 }, 3), true);
  assert.equal(stack.getPartStage({ kind: "core", index: 0 }), 3);
  assert.equal(stack.setPartStage({ kind: "core", index: 1 }, 3), false);
  assert.equal(stack.getPartStage({ kind: "core", index: 1 }), 1);

  assert.equal(stack.getPartStage({ kind: "booster", index: 0 }), 1);
  assert.equal(stack.setPartStage({ kind: "booster", index: 0 }, 2), true);
  assert.equal(stack.getPartStage({ kind: "booster", index: 0 }), 2);
});

test("engine after separator gets auto-incremented stage by default", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  assert.equal(stack.placePartOnTarget("engine", stack.getSnapTargets(anchorX, anchorY, "engine")[0]), true);
  assert.equal(stack.placePartOnTarget("fuel_tank", stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0]), true);
  assert.equal(
    stack.placePartOnTarget("stage_separator", stack.getSnapTargets(anchorX, anchorY, "stage_separator")[0]),
    true
  );
  assert.equal(stack.placePartOnTarget("engine", stack.getSnapTargets(anchorX, anchorY, "engine")[0]), true);

  assert.equal(stack.getPartStage({ kind: "core", index: 0 }), 1);
  assert.equal(stack.getPartStage({ kind: "core", index: 2 }), 1);
  assert.equal(stack.getPartStage({ kind: "core", index: 3 }), 2);
});

test("separator is dropped with lower stage when filtering by current stage", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  assert.equal(stack.placePartOnTarget("engine", stack.getSnapTargets(anchorX, anchorY, "engine")[0]), true);
  assert.equal(stack.placePartOnTarget("fuel_tank", stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0]), true);
  assert.equal(
    stack.placePartOnTarget("stage_separator", stack.getSnapTargets(anchorX, anchorY, "stage_separator")[0]),
    true
  );
  assert.equal(stack.placePartOnTarget("engine", stack.getSnapTargets(anchorX, anchorY, "engine")[0]), true);

  const stage1Rects = stack.getVesselPartRects({ minStage: 1 });
  const stage2Rects = stack.getVesselPartRects({ minStage: 2 });
  assert.ok(stage1Rects.some((rect) => rect.type === "stage_separator"));
  assert.ok(stage2Rects.every((rect) => rect.type !== "stage_separator"));
});

test("flight setup isolates fuel compartments across stage separators", () => {
  const stack = new RocketStack();
  const anchorX = 300;
  const anchorY = 420;

  assert.equal(stack.placePartOnTarget("engine", stack.getSnapTargets(anchorX, anchorY, "engine")[0]), true);
  assert.equal(stack.placePartOnTarget("fuel_tank", stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0]), true);
  assert.equal(
    stack.placePartOnTarget("stage_separator", stack.getSnapTargets(anchorX, anchorY, "stage_separator")[0]),
    true
  );
  assert.equal(stack.placePartOnTarget("engine", stack.getSnapTargets(anchorX, anchorY, "engine")[0]), true);
  assert.equal(stack.placePartOnTarget("fuel_tank", stack.getSnapTargets(anchorX, anchorY, "fuel_tank")[0]), true);

  stack.setPartStage({ kind: "core", index: 0 }, 1);
  stack.setPartStage({ kind: "core", index: 3 }, 2);

  const setup = stack.getFlightSetup();
  assert.equal(setup.mainEngines.length, 2);
  assert.equal(setup.mainEngines[0].stage, 1);
  assert.equal(setup.mainEngines[1].stage, 2);
  assert.equal(setup.mainEngines[0].compartment, 0);
  assert.equal(setup.mainEngines[1].compartment, 1);
  assert.equal(setup.fuelCompartments.length, 2);
  assert.equal(setup.fuelCompartments[0].fuel, 75);
  assert.equal(setup.fuelCompartments[1].fuel, 45);
});
