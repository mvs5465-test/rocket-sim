(function () {
  const K2D = window.K2D || (window.K2D = {});

  const DEFAULT_CONFIG = {
    gravity: 42,
    gravityMin: 8,
    gravityFalloff: 2600,
    mainThrustPerEngine: 845,
    boosterThrust: 640,
    boosterFuelPerBooster: 16,
    boosterBurnRate: 4.8,
    safeLandingSpeed: 20,
    steeringThrust: 130,
    turnRate: 3.2,
    fuelBurnMain: 6.8,
    linearDrag: 0.994,
    angularDrag: 0.982
  };

  function createConfig(overrides) {
    return Object.assign({}, DEFAULT_CONFIG, overrides || {});
  }

  function normalizeStage(stage) {
    const parsed = Number.parseInt(stage, 10);
    return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
  }

  function getMaxStage(vessel) {
    let maxStage = 1;
    for (const engine of vessel.mainEngines) {
      maxStage = Math.max(maxStage, engine.stage);
    }
    for (const booster of vessel.boosterUnits) {
      maxStage = Math.max(maxStage, booster.stage);
    }
    return maxStage;
  }

  function buildStageEvents(vessel) {
    const events = [];
    const maxStage = getMaxStage(vessel);
    for (let stage = 1; stage < maxStage; stage += 1) {
      const hasBoosters = vessel.boosterUnits.some((booster) => booster.attached && booster.stage === stage);
      if (hasBoosters) {
        events.push({ type: "jettison_boosters", stage });
      }
      events.push({ type: "separate_core", stage, nextStage: stage + 1 });
    }
    return events;
  }

  function updateCenterOfMass(vessel) {
    // Approximate longitudinal COM for staging behavior and HUD/debug state.
    let weightedY = 0;
    let totalMass = 0;
    const massPoints = [];

    for (let i = 0; i < vessel.coreStageMasses.length; i += 1) {
      if (vessel.droppedCoreStages[i]) {
        continue;
      }
      const stageNumber = i + 1;
      const y = stageNumber;
      const dry = Math.max(0, vessel.coreStageMasses[i] || 0);
      const compartment = vessel.fuelCompartments[i];
      const fuelMass = compartment ? Math.max(0, compartment.fuel) * 0.03 : 0;
      const mass = dry + fuelMass;
      weightedY += y * mass;
      totalMass += mass;
      massPoints.push({ y, mass });
    }

    for (const booster of vessel.boosterUnits) {
      if (!booster.attached) {
        continue;
      }
      const y = booster.stage + 0.2;
      const mass = Math.max(0, booster.dryMass) + Math.max(0, booster.fuel) * 0.015;
      weightedY += y * mass;
      totalMass += mass;
      massPoints.push({ y, mass });
    }

    vessel.centerOfMassY = totalMass > 0 ? weightedY / totalMass : 0;
    let inertia = 0;
    for (const point of massPoints) {
      inertia += point.mass * Math.pow(point.y - vessel.centerOfMassY, 2);
    }
    vessel.inertiaY = Math.max(0.25, inertia);
  }

  function recomputeStageState(vessel) {
    vessel.fuel = vessel.fuelCompartments.reduce((sum, compartment) => sum + Math.max(0, compartment.fuel), 0);
    vessel.fuelCapacity = vessel.fuelCompartments.reduce(
      (sum, compartment) => sum + Math.max(0, compartment.capacity),
      0
    );
    vessel.boosterFuel = vessel.boosterUnits.reduce((sum, unit) => sum + Math.max(0, unit.fuel), 0);
    vessel.boosterCount = vessel.boosterUnits.filter((unit) => unit.attached).length;
    vessel.boosterAttached = vessel.boosterCount > 0;

    vessel.activeMainEngineCount = vessel.mainEngines.filter(
      (engine) =>
        engine.stage === vessel.currentStage &&
        vessel.fuelCompartments[engine.compartment] &&
        vessel.fuelCompartments[engine.compartment].fuel > 0
    ).length;
    vessel.activeBoosterCount = vessel.boosterUnits.filter(
      (unit) => unit.attached && unit.stage === vessel.currentStage && unit.fuel > 0
    ).length;
    vessel.mainThrust = vessel.activeMainEngineCount * vessel.mainThrustPerEngine;
    vessel.boosterThrust = vessel.activeBoosterCount * vessel.boosterThrustPerUnit;

    updateCenterOfMass(vessel);
  }

  function createVessel(params) {
    const cfg = createConfig(params.config);
    const legacyEngineCount = params.mainEngineCount || 0;
    const mainEngines = Array.isArray(params.mainEngines)
      ? params.mainEngines.map((engine) => ({
          stage: normalizeStage(engine.stage),
          compartment: Math.max(0, Number.parseInt(engine.compartment, 10) || 0)
        }))
      : Array.from({ length: legacyEngineCount }, () => ({ stage: 1, compartment: 0 }));

    const fuelCompartments = Array.isArray(params.fuelCompartments)
      ? params.fuelCompartments.map((compartment) => {
          const cap = Math.max(0, compartment.capacity || 0);
          const fuel = Math.max(0, Math.min(cap, compartment.fuel == null ? cap : compartment.fuel));
          return { capacity: cap, fuel };
        })
      : [{ capacity: Math.max(0, params.fuelCapacity || 0), fuel: Math.max(0, params.fuelCapacity || 0) }];

    const legacyBoosterCount = params.boosterCount || 0;
    const legacyBoosterDryMass = Math.max(0, params.boosterDryMass || 0);
    const boosterUnits = Array.isArray(params.boosterUnits)
      ? params.boosterUnits.map((unit) => ({
          stage: normalizeStage(unit.stage),
          dryMass: Math.max(0, unit.dryMass || 0),
          fuel: cfg.boosterFuelPerBooster,
          attached: true
        }))
      : Array.from({ length: legacyBoosterCount }, () => ({
          stage: 1,
          dryMass: legacyBoosterCount > 0 ? legacyBoosterDryMass / legacyBoosterCount : 0,
          fuel: cfg.boosterFuelPerBooster,
          attached: true
        }));

    const vessel = {
      x: params.x,
      y: params.y,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVelocity: 0,
      dryMass: params.dryMass,
      mainThrustPerEngine: cfg.mainThrustPerEngine,
      boosterThrustPerUnit: cfg.boosterThrust,
      mainEngines,
      fuelCompartments,
      boosterUnits,
      coreStageMasses: Array.isArray(params.coreStageMasses) ? params.coreStageMasses.slice() : [],
      droppedCoreStages: [],
      detachedBoosterStages: [],
      currentStage: 1,
      stageEvents: [],
      stageEventCursor: 0,
      centerOfMassY: 0,
      steeringThrust: cfg.steeringThrust,
      turnRate: cfg.turnRate,
      flightState: "flying",
      lastTouchdownSpeed: 0
    };

    vessel.stageEvents = buildStageEvents(vessel);
    recomputeStageState(vessel);
    return vessel;
  }

  function jettisonBoostersForStage(vessel, stage) {
    let changed = false;
    for (const booster of vessel.boosterUnits) {
      if (!booster.attached || booster.stage !== stage) {
        continue;
      }
      booster.attached = false;
      booster.fuel = 0;
      vessel.dryMass = Math.max(1, vessel.dryMass - booster.dryMass);
      changed = true;
    }
    if (changed && !vessel.detachedBoosterStages.includes(stage)) {
      vessel.detachedBoosterStages.push(stage);
    }
    return changed;
  }

  function separateCoreStage(vessel, stage) {
    const stageIndex = stage - 1;
    if (!vessel.droppedCoreStages[stageIndex]) {
      const droppedMass = vessel.coreStageMasses[stageIndex] || 0;
      if (droppedMass > 0) {
        vessel.dryMass = Math.max(1, vessel.dryMass - droppedMass);
      }
      vessel.droppedCoreStages[stageIndex] = true;
    }

    if (vessel.fuelCompartments[stageIndex]) {
      vessel.fuelCompartments[stageIndex].fuel = 0;
      vessel.fuelCompartments[stageIndex].capacity = 0;
    }
  }

  function activateNextStage(vessel) {
    if (!vessel) {
      return { ok: false, reason: "missing_vessel" };
    }

    if (vessel.stageEventCursor >= vessel.stageEvents.length) {
      return { ok: false, reason: "no_remaining_stage_event" };
    }

    const event = vessel.stageEvents[vessel.stageEventCursor];
    vessel.stageEventCursor += 1;
    const inertiaBefore = Math.max(0.01, vessel.inertiaY || 1);

    if (event.type === "jettison_boosters") {
      jettisonBoostersForStage(vessel, event.stage);
    } else if (event.type === "separate_core") {
      separateCoreStage(vessel, event.stage);
      vessel.currentStage = event.nextStage;
    }

    recomputeStageState(vessel);
    if (event.type === "separate_core") {
      const inertiaAfter = Math.max(0.01, vessel.inertiaY || 1);
      const scale = Math.max(0.35, Math.min(3, inertiaBefore / inertiaAfter));
      vessel.angularVelocity *= scale;
    }
    return {
      ok: true,
      type: event.type,
      stage: event.stage,
      currentStage: vessel.currentStage
    };
  }

  function getGravityAtAltitude(altitude, config) {
    const cfg = createConfig(config);
    const alt = Math.max(0, altitude || 0);
    return cfg.gravityMin + (cfg.gravity - cfg.gravityMin) / (1 + alt / cfg.gravityFalloff);
  }

  function getCurrentMass(vessel) {
    return vessel.dryMass + Math.max(0, vessel.fuel) * 0.03 + Math.max(0, vessel.boosterFuel) * 0.015;
  }

  function getAvailableThrust(vessel) {
    return (vessel.mainThrust || 0) + (vessel.boosterThrust || 0);
  }

  function stepVessel(vessel, input, deltaSeconds, env, config) {
    const cfg = createConfig(config);
    const altitude = env && typeof env.altitude === "number" ? env.altitude : 0;
    const gravityNow = getGravityAtAltitude(altitude, cfg);
    const groundY = env && typeof env.groundY === "number" ? env.groundY : 1000;

    recomputeStageState(vessel);

    if (vessel.flightState === "crashed") {
      vessel.y = Math.min(vessel.y, groundY - 2);
      vessel.vx = 0;
      vessel.vy = 0;
      vessel.angularVelocity = 0;
      vessel.currentGravity = gravityNow;
      return vessel;
    }

    const mass = getCurrentMass(vessel);
    const forwardX = Math.sin(vessel.angle);
    const forwardY = -Math.cos(vessel.angle);

    let ax = 0;
    let ay = gravityNow;

    if (input.Space && vessel.activeMainEngineCount > 0) {
      ax += (forwardX * vessel.mainThrust) / mass;
      ay += (forwardY * vessel.mainThrust) / mass;
      for (const engine of vessel.mainEngines) {
        if (engine.stage !== vessel.currentStage) {
          continue;
        }
        const compartment = vessel.fuelCompartments[engine.compartment];
        if (!compartment || compartment.fuel <= 0) {
          continue;
        }
        compartment.fuel = Math.max(0, compartment.fuel - cfg.fuelBurnMain * deltaSeconds);
      }
    }

    if (input.Space && vessel.activeBoosterCount > 0) {
      ax += (forwardX * vessel.boosterThrust) / mass;
      ay += (forwardY * vessel.boosterThrust) / mass;
      for (const booster of vessel.boosterUnits) {
        if (!booster.attached || booster.stage !== vessel.currentStage || booster.fuel <= 0) {
          continue;
        }
        booster.fuel = Math.max(0, booster.fuel - cfg.boosterBurnRate * deltaSeconds);
      }
    }

    const turnResponse = vessel.turnRate / Math.max(0.6, vessel.inertiaY * 0.22);
    if (input.KeyA) {
      vessel.angularVelocity -= turnResponse * deltaSeconds;
    }
    if (input.KeyD) {
      vessel.angularVelocity += turnResponse * deltaSeconds;
    }

    vessel.vx += ax * deltaSeconds;
    vessel.vy += ay * deltaSeconds;
    vessel.x += vessel.vx * deltaSeconds;
    vessel.y += vessel.vy * deltaSeconds;
    vessel.vx *= cfg.linearDrag;
    vessel.vy *= cfg.linearDrag;
    vessel.angularVelocity *= cfg.angularDrag;
    vessel.angle += vessel.angularVelocity * deltaSeconds;

    if (vessel.y > groundY - 2 && vessel.vy > 0) {
      const impactSpeed = vessel.vy;
      vessel.lastTouchdownSpeed = impactSpeed;
      vessel.flightState = impactSpeed > cfg.safeLandingSpeed ? "crashed" : "landed";
      vessel.y = groundY - 2;
      vessel.vy = 0;
      vessel.vx *= vessel.flightState === "crashed" ? 0.25 : 0.92;
      if (vessel.flightState === "crashed") {
        vessel.angularVelocity = 0;
      }
    } else if (vessel.y < groundY - 2.5) {
      vessel.flightState = "flying";
    }

    vessel.currentGravity = gravityNow;
    recomputeStageState(vessel);

    return vessel;
  }

  K2D.FlightModel = {
    DEFAULT_CONFIG,
    createConfig,
    createVessel,
    activateNextStage,
    getGravityAtAltitude,
    getCurrentMass,
    getAvailableThrust,
    stepVessel
  };
})();
