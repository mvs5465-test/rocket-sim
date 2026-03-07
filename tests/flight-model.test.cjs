const test = require("node:test");
const assert = require("node:assert/strict");
const { loadK2D } = require("./helpers/load-k2d.cjs");

const K2D = loadK2D(["src/js/flight-model.js"]);
const { FlightModel } = K2D;

function createInput(overrides) {
  return Object.assign(
    {
      KeyA: false,
      KeyD: false,
      Space: false
    },
    overrides || {}
  );
}

test("vessel starts pointed up (angle 0) and Space thrust moves upward", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });

  assert.equal(vessel.angle, 0);
  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.5, { groundY: 1000 });

  assert.ok(vessel.y < 300, "vessel should gain upward velocity and reduce y");
  assert.ok(Math.abs(vessel.vx) < 0.0001, "no lateral drift when pointing straight up");
});

test("without thrust vessel falls due to gravity", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 0,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });

  FlightModel.stepVessel(vessel, createInput(), 0.5, { groundY: 1000 });
  assert.ok(vessel.y > 300);
});

test("A/D steering changes angular velocity in opposite directions", () => {
  const left = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });
  const right = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });

  FlightModel.stepVessel(left, createInput({ KeyA: true }), 0.2, { groundY: 1000 });
  FlightModel.stepVessel(right, createInput({ KeyD: true }), 0.2, { groundY: 1000 });

  assert.ok(left.angularVelocity < 0);
  assert.ok(right.angularVelocity > 0);
});

test("tilting left then thrusting gives leftward acceleration", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });

  vessel.angle = -0.35;
  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.3, { groundY: 1000 });
  assert.ok(vessel.vx < 0, "expected leftward velocity when pointing left");
});

test("fuel burns only when Space thrust is active", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 20,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });

  const fuel0 = vessel.fuel;
  FlightModel.stepVessel(vessel, createInput(), 0.25, { groundY: 1000 });
  const fuel1 = vessel.fuel;
  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.25, { groundY: 1000 });
  const fuel2 = vessel.fuel;

  assert.equal(fuel1, fuel0);
  assert.ok(fuel2 < fuel1);
});

test("booster fuel burns only while firing and contributes additional thrust", () => {
  const noBooster = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });
  const withBooster = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 2
  });

  const boosterFuel0 = withBooster.boosterFuel;
  FlightModel.stepVessel(withBooster, createInput(), 0.2, { groundY: 1000 });
  assert.equal(withBooster.boosterFuel, boosterFuel0, "booster fuel should not burn without Space");

  const withBoosterForThrust = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 2
  });

  FlightModel.stepVessel(noBooster, createInput({ Space: true }), 0.2, { groundY: 1000 });
  FlightModel.stepVessel(withBoosterForThrust, createInput({ Space: true }), 0.2, { groundY: 1000 });

  assert.ok(withBoosterForThrust.boosterFuel < boosterFuel0, "booster fuel should burn while firing");
  assert.ok(withBoosterForThrust.y < noBooster.y, "booster craft should climb further in the same timestep");
});

test("W/S keys do not affect thrust or fuel after control simplification", () => {
  const base = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });
  const withW = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });

  FlightModel.stepVessel(base, createInput(), 0.25, { groundY: 1000 });
  FlightModel.stepVessel(withW, createInput({ KeyW: true, KeyS: true }), 0.25, { groundY: 1000 });

  assert.equal(withW.vx, base.vx);
  assert.equal(withW.vy, base.vy);
  assert.equal(withW.fuel, base.fuel);
});

test("gravity decreases with altitude but never reaches zero", () => {
  const gSea = FlightModel.getGravityAtAltitude(0);
  const gHigh = FlightModel.getGravityAtAltitude(5000);
  const gVeryHigh = FlightModel.getGravityAtAltitude(500000);

  assert.ok(gHigh < gSea);
  assert.ok(gVeryHigh > 0);
  assert.ok(gVeryHigh >= FlightModel.DEFAULT_CONFIG.gravityMin);
});

test("current vessel mass decreases as fuel burns", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    fuelCapacity: 100,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 2
  });

  const m0 = FlightModel.getCurrentMass(vessel);
  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.6, { groundY: 1000, altitude: 0 });
  const m1 = FlightModel.getCurrentMass(vessel);

  assert.ok(m1 < m0);
});
