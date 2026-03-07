(function () {
  const K2D = window.K2D || (window.K2D = {});

  const DEFAULT_CONFIG = {
    gravity: 42,
    gravityMin: 8,
    gravityFalloff: 2600,
    mainThrustPerEngine: 520,
    boosterThrust: 320,
    boosterFuelPerBooster: 16,
    boosterBurnRate: 4.8,
    steeringThrust: 130,
    turnRate: 3.2,
    fuelBurnMain: 6.8,
    linearDrag: 0.994,
    angularDrag: 0.982
  };

  function createConfig(overrides) {
    return Object.assign({}, DEFAULT_CONFIG, overrides || {});
  }

  function createVessel(params) {
    const cfg = createConfig(params.config);
    return {
      x: params.x,
      y: params.y,
      vx: 0,
      vy: 0,
      // Angle 0 means the craft points "up" because its unrotated model is vertical.
      angle: 0,
      angularVelocity: 0,
      fuel: params.fuelCapacity,
      fuelCapacity: params.fuelCapacity,
      boosterFuel: (params.boosterCount || 0) * cfg.boosterFuelPerBooster,
      dryMass: params.dryMass,
      mainThrust: params.mainEngineCount * cfg.mainThrustPerEngine,
      boosterThrust: params.boosterCount * cfg.boosterThrust,
      boosterCount: params.boosterCount || 0,
      steeringThrust: cfg.steeringThrust,
      turnRate: cfg.turnRate
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
    let thrust = 0;
    if (vessel.fuel > 0) {
      thrust += vessel.mainThrust;
    }
    if (vessel.boosterFuel > 0) {
      thrust += vessel.boosterThrust;
    }
    return thrust;
  }

  function stepVessel(vessel, input, deltaSeconds, env, config) {
    const cfg = createConfig(config);
    const altitude = env && typeof env.altitude === "number" ? env.altitude : 0;
    const gravityNow = getGravityAtAltitude(altitude, cfg);
    const hasMainFuel = vessel.fuel > 0;
    const hasBoosterFuel = vessel.boosterFuel > 0;
    const mass = getCurrentMass(vessel);

    // Forward direction aligns with the craft nose; at angle 0 this is straight up.
    const forwardX = Math.sin(vessel.angle);
    const forwardY = -Math.cos(vessel.angle);

    let ax = 0;
    let ay = gravityNow;

    if (hasMainFuel && input.Space) {
      ax += (forwardX * vessel.mainThrust) / mass;
      ay += (forwardY * vessel.mainThrust) / mass;
      vessel.fuel = Math.max(0, vessel.fuel - cfg.fuelBurnMain * deltaSeconds);
    }

    if (hasBoosterFuel && input.Space && vessel.boosterThrust > 0) {
      ax += (forwardX * vessel.boosterThrust) / mass;
      ay += (forwardY * vessel.boosterThrust) / mass;
      vessel.boosterFuel = Math.max(0, vessel.boosterFuel - cfg.boosterBurnRate * deltaSeconds);
    }

    if (input.KeyA) {
      vessel.angularVelocity -= vessel.turnRate * deltaSeconds;
    }
    if (input.KeyD) {
      vessel.angularVelocity += vessel.turnRate * deltaSeconds;
    }

    vessel.vx += ax * deltaSeconds;
    vessel.vy += ay * deltaSeconds;
    vessel.x += vessel.vx * deltaSeconds;
    vessel.y += vessel.vy * deltaSeconds;
    vessel.vx *= cfg.linearDrag;
    vessel.vy *= cfg.linearDrag;
    vessel.angularVelocity *= cfg.angularDrag;
    vessel.angle += vessel.angularVelocity * deltaSeconds;

    if (vessel.y > env.groundY - 2 && vessel.vy > 0) {
      vessel.y = env.groundY - 2;
      vessel.vy = 0;
      vessel.vx *= 0.92;
    }

    vessel.currentGravity = gravityNow;

    return vessel;
  }

  K2D.FlightModel = {
    DEFAULT_CONFIG,
    createConfig,
    createVessel,
    getGravityAtAltitude,
    getCurrentMass,
    getAvailableThrust,
    stepVessel
  };
})();
