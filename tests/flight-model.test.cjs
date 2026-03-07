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

test("touchdown below safe landing speed marks vessel as landed", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 997.9,
    fuelCapacity: 60,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });
  vessel.vy = 8;

  FlightModel.stepVessel(
    vessel,
    createInput(),
    0.05,
    { groundY: 1000, altitude: 0 },
    { safeLandingSpeed: 20 }
  );

  assert.equal(vessel.flightState, "landed");
  assert.equal(vessel.y, 998);
  assert.equal(vessel.vy, 0);
  assert.ok(vessel.lastTouchdownSpeed > 0);
});

test("hard impact marks vessel crashed and prevents further thrust updates", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 999,
    fuelCapacity: 60,
    dryMass: 6,
    mainEngineCount: 1,
    boosterCount: 0
  });
  vessel.vy = 30;

  FlightModel.stepVessel(
    vessel,
    createInput(),
    0.05,
    { groundY: 1000, altitude: 0 },
    { safeLandingSpeed: 10 }
  );

  assert.equal(vessel.flightState, "crashed");
  const yAfterImpact = vessel.y;
  const fuelAfterImpact = vessel.fuel;

  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.2, { groundY: 1000, altitude: 0 });
  assert.equal(vessel.y, yAfterImpact);
  assert.equal(vessel.fuel, fuelAfterImpact);
});

test("activateNextStage advances to next stage and detaches prior-stage boosters", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 10,
    mainEngines: [
      { stage: 1, compartment: 0 },
      { stage: 2, compartment: 1 }
    ],
    fuelCompartments: [
      { fuel: 40, capacity: 40 },
      { fuel: 40, capacity: 40 }
    ],
    coreStageMasses: [4, 3],
    boosterUnits: [
      { stage: 1, dryMass: 0.9 },
      { stage: 2, dryMass: 0.9 }
    ]
  });

  const dryMassBefore = vessel.dryMass;
  const comBefore = vessel.centerOfMassY;
  const inertiaBefore = vessel.inertiaY;
  const stageEvent1 = FlightModel.activateNextStage(vessel);
  assert.equal(stageEvent1.ok, true);
  assert.equal(stageEvent1.type, "jettison_boosters");
  assert.equal(vessel.currentStage, 1);
  assert.equal(vessel.boosterCount, 1);
  assert.equal(vessel.detachedBoosterStages.includes(1), true);
  assert.equal(vessel.fuelCompartments[0].fuel, 40);
  assert.equal(vessel.fuelCompartments[0].capacity, 40);

  const stageEvent2 = FlightModel.activateNextStage(vessel);
  assert.equal(stageEvent2.ok, true);
  assert.equal(stageEvent2.type, "separate_core");
  assert.equal(vessel.currentStage, 2);
  assert.equal(vessel.boosterCount, 1);
  assert.equal(vessel.fuelCompartments[0].fuel, 0);
  assert.equal(vessel.fuelCompartments[0].capacity, 0);
  assert.ok(vessel.dryMass < dryMassBefore);
  assert.ok(vessel.centerOfMassY > comBefore, "center of mass should shift toward remaining upper stage");
  assert.ok(vessel.inertiaY < inertiaBefore, "inertia should decrease after dropping a lower stage");
});

test("activateNextStage returns false when already at highest stage", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 8,
    mainEngines: [{ stage: 1, compartment: 0 }],
    fuelCompartments: [{ fuel: 80, capacity: 80 }]
  });

  const eventResult = FlightModel.activateNextStage(vessel);
  assert.equal(eventResult.ok, false);
});

test("activateNextStage directly separates core when current stage has no boosters", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 8,
    mainEngines: [
      { stage: 1, compartment: 0 },
      { stage: 2, compartment: 1 }
    ],
    fuelCompartments: [
      { fuel: 40, capacity: 40 },
      { fuel: 40, capacity: 40 }
    ],
    coreStageMasses: [3, 3],
    boosterUnits: [{ stage: 2, dryMass: 0.9 }]
  });

  const eventResult = FlightModel.activateNextStage(vessel);
  assert.equal(eventResult.ok, true);
  assert.equal(eventResult.type, "separate_core");
  assert.equal(vessel.currentStage, 2);
  assert.equal(vessel.fuelCompartments[0].capacity, 0);
});

test("only engines in current stage produce thrust", () => {
  const stage1 = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 8,
    mainEngines: [
      { stage: 1, compartment: 0 },
      { stage: 2, compartment: 1 }
    ],
    fuelCompartments: [
      { fuel: 50, capacity: 50 },
      { fuel: 50, capacity: 50 }
    ]
  });
  const stage2 = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 8,
    mainEngines: [
      { stage: 1, compartment: 0 },
      { stage: 2, compartment: 1 }
    ],
    fuelCompartments: [
      { fuel: 50, capacity: 50 },
      { fuel: 50, capacity: 50 }
    ]
  });

  FlightModel.activateNextStage(stage2);
  FlightModel.activateNextStage(stage2);
  FlightModel.stepVessel(stage1, createInput({ Space: true }), 0.2, { groundY: 1000 });
  FlightModel.stepVessel(stage2, createInput({ Space: true }), 0.2, { groundY: 1000 });

  assert.ok(stage1.y < 300);
  assert.ok(stage2.y < 300);
  assert.ok(stage1.fuelCompartments[0].fuel < 50);
  assert.equal(stage1.fuelCompartments[1].fuel, 50);
  assert.equal(stage2.fuelCompartments[0].fuel, 0);
  assert.equal(stage2.fuelCompartments[0].capacity, 0);
  assert.ok(stage2.fuelCompartments[1].fuel < 50);
});

test("fuel does not flow across stage separator compartments", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 10,
    mainEngines: [
      { stage: 1, compartment: 0 },
      { stage: 1, compartment: 0 },
      { stage: 2, compartment: 1 }
    ],
    fuelCompartments: [
      { fuel: 20, capacity: 20 },
      { fuel: 70, capacity: 70 }
    ]
  });

  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.2, { groundY: 1000 });

  assert.ok(vessel.fuelCompartments[0].fuel < 20);
  assert.equal(vessel.fuelCompartments[1].fuel, 70);
});

test("boosters fire only in their assigned stage and detach on next stage", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 9,
    mainEngines: [
      { stage: 1, compartment: 0 },
      { stage: 2, compartment: 1 }
    ],
    fuelCompartments: [
      { fuel: 30, capacity: 30 },
      { fuel: 30, capacity: 30 }
    ],
    coreStageMasses: [3, 3],
    boosterUnits: [
      { stage: 1, dryMass: 0.9 },
      { stage: 2, dryMass: 0.9 }
    ]
  });

  const b0 = vessel.boosterUnits[0].fuel;
  const b1 = vessel.boosterUnits[1].fuel;
  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.2, { groundY: 1000 });
  assert.ok(vessel.boosterUnits[0].fuel < b0);
  assert.equal(vessel.boosterUnits[1].fuel, b1);

  const jettison = FlightModel.activateNextStage(vessel);
  assert.equal(jettison.type, "jettison_boosters");
  assert.equal(vessel.currentStage, 1);
  assert.equal(vessel.boosterUnits[0].attached, false);
  const separate = FlightModel.activateNextStage(vessel);
  assert.equal(separate.type, "separate_core");
  assert.equal(vessel.currentStage, 2);
  const b1AfterStage = vessel.boosterUnits[1].fuel;
  FlightModel.stepVessel(vessel, createInput({ Space: true }), 0.2, { groundY: 1000 });
  assert.ok(vessel.boosterUnits[1].fuel < b1AfterStage);
});

test("multi-stage separation updates COM/inertia from middle to upper stage", () => {
  const vessel = FlightModel.createVessel({
    x: 0,
    y: 300,
    dryMass: 15,
    mainEngines: [
      { stage: 1, compartment: 0 },
      { stage: 2, compartment: 1 },
      { stage: 3, compartment: 2 }
    ],
    fuelCompartments: [
      { fuel: 30, capacity: 30 },
      { fuel: 30, capacity: 30 },
      { fuel: 30, capacity: 30 }
    ],
    coreStageMasses: [5, 5, 4],
    boosterUnits: [{ stage: 1, dryMass: 0.9 }]
  });

  // Stage 1: booster jettison then core separation.
  assert.equal(FlightModel.activateNextStage(vessel).type, "jettison_boosters");
  const firstCoreSep = FlightModel.activateNextStage(vessel);
  assert.equal(firstCoreSep.type, "separate_core");
  assert.equal(vessel.currentStage, 2);

  const comBefore = vessel.centerOfMassY;
  const inertiaBefore = vessel.inertiaY;
  vessel.angularVelocity = 0.3;
  const secondCoreSep = FlightModel.activateNextStage(vessel);

  assert.equal(secondCoreSep.type, "separate_core");
  assert.equal(vessel.currentStage, 3);
  assert.ok(vessel.centerOfMassY > comBefore);
  assert.ok(vessel.inertiaY < inertiaBefore);
  assert.ok(vessel.angularVelocity > 0.3, "angular velocity should reflect reduced inertia after staging");
});
