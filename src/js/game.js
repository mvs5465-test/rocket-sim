(function () {
  const K2D = window.K2D;
  const PART_DEFS = K2D.PART_DEFS;
  const RocketStack = K2D.RocketStack;
  const FlightModel = K2D.FlightModel;
  const CameraModel = K2D.CameraModel;

  class Game {
    constructor({ renderer, scene, partsPalette }) {
      this.renderer = renderer;
      this.scene = scene;
      this.partsPalette = partsPalette;
      this.rocketStack = new RocketStack();
      this.mode = "build";
      this.lastTimestampMs = 0;
      this.isRunning = false;

      this.pointer = { x: 0, y: 0, active: false };
      this.selectedPartRef = null;
      this.placementTarget = null;
      this.dragState = null;

      this.keyState = {
        KeyA: false,
        KeyD: false,
        Space: false
      };

      this.flightConfig = FlightModel.createConfig();

      this.vessel = null;
      this.nozzles = [];
      this.camera = { x: 0, y: 0 };
      this.flightCameraBase = { x: 0, y: 0 };
      this.thrustActive = false;
      this.boosterActive = false;
      this.exhaustParticles = [];
      this.particleSpawnCarry = 0;
      this.liftoffPuffDone = false;

      this.tooltipEl = document.querySelector("#part-tooltip");
      this.tooltipTitleEl = document.querySelector("#tooltip-title");
      this.tooltipMetaEl = document.querySelector("#tooltip-meta");
      this.deleteButtonEl = document.querySelector("#delete-part-button");
      this.launchButtonEl = document.querySelector("#launch-button");
      this.recoverButtonEl = document.querySelector("#recover-button");
      this.buildModePanelEl = document.querySelector("#build-mode-panel");
      this.flightModePanelEl = document.querySelector("#flight-mode-panel");
      this.hudPanelEl = document.querySelector("#hud-panel");
      this.hudAltitudeEl = document.querySelector("#hud-altitude");
      this.hudSpeedEl = document.querySelector("#hud-speed");
      this.hudFuelEl = document.querySelector("#hud-fuel");
      this.hudMassEl = document.querySelector("#hud-mass");
      this.hudGravityEl = document.querySelector("#hud-gravity");
      this.hudTwrEl = document.querySelector("#hud-twr");

      this.bindEvents();
      this.seedStarterRocket();
      this.syncUiForMode();
    }

    start() {
      if (this.isRunning) {
        return;
      }
      this.isRunning = true;
      this.lastTimestampMs = performance.now();
      requestAnimationFrame((timestampMs) => this.tick(timestampMs));
    }

    tick(timestampMs) {
      if (!this.isRunning) {
        return;
      }
      const deltaSeconds = Math.min((timestampMs - this.lastTimestampMs) / 1000, 0.1);
      this.lastTimestampMs = timestampMs;

      this.scene.update(deltaSeconds, this.renderer.width);
      if (this.mode === "flight") {
        this.updateFlight(deltaSeconds);
      }
      if (this.mode === "build") {
        this.launchButtonEl.disabled = !this.rocketStack.isLaunchReady();
      }

      this.draw();
      requestAnimationFrame((nextTimestampMs) => this.tick(nextTimestampMs));
    }

    bindEvents() {
      this.renderer.canvas.addEventListener("mousemove", (event) => {
        if (this.mode !== "build") {
          return;
        }
        const point = this.getCanvasPoint(event);
        this.pointer.x = point.x;
        this.pointer.y = point.y;
        this.pointer.active = true;
        this.refreshPlacementTarget();

        if (this.dragState && this.dragState.pointerDown && !this.dragState.active) {
          const distance = Math.hypot(
            point.x - this.dragState.startPointer.x,
            point.y - this.dragState.startPointer.y
          );
          if (distance > 6) {
            this.dragState.active = true;
            this.closeTooltip();
          }
        }

        if (this.dragState && this.dragState.active && this.dragState.partRef.kind === "core") {
          const anchor = this.getBuildAnchor();
          this.dragState.targetIndex = this.rocketStack.getReorderIndexForPointer(anchor.x, anchor.y, point.y);
        }
      });

      this.renderer.canvas.addEventListener("mouseleave", () => {
        this.pointer.active = false;
        this.placementTarget = null;
      });

      this.renderer.canvas.addEventListener("mousedown", (event) => {
        if (this.mode !== "build") {
          return;
        }
        const point = this.getCanvasPoint(event);
        const anchor = this.getBuildAnchor();
        const hitPart = this.rocketStack.findPartAt(anchor.x, anchor.y, point.x, point.y);
        if (!hitPart || hitPart.kind !== "core") {
          this.dragState = null;
          return;
        }
        this.dragState = {
          pointerDown: true,
          active: false,
          startPointer: point,
          partRef: {
            kind: hitPart.kind,
            index: hitPart.index,
            type: hitPart.type
          },
          targetIndex: null
        };
      });

      this.renderer.canvas.addEventListener("mouseup", (event) => {
        if (this.mode !== "build") {
          return;
        }

        const point = this.getCanvasPoint(event);
        this.pointer.x = point.x;
        this.pointer.y = point.y;
        this.pointer.active = true;
        this.refreshPlacementTarget();
        const anchor = this.getBuildAnchor();

        if (this.dragState && this.dragState.pointerDown && this.dragState.active) {
          this.finishDrag();
          this.dragState = null;
          return;
        }

        const hitPart = this.rocketStack.findPartAt(anchor.x, anchor.y, point.x, point.y);
        if (hitPart) {
          this.openTooltip(hitPart);
          this.partsPalette.setStatus(`Selected ${PART_DEFS[hitPart.type].label}.`);
          this.dragState = null;
          return;
        }

        this.closeTooltip();
        this.tryPlaceSelectedPart();
        this.dragState = null;
      });

      window.addEventListener("keydown", (event) => {
        if (this.mode === "build" && event.code === "Space") {
          event.preventDefault();
          if (!event.repeat) {
            this.launch();
          }
          return;
        }

        if (event.code in this.keyState) {
          this.keyState[event.code] = true;
          if (event.code === "Space") {
            event.preventDefault();
          }
        }

        if (event.key === "Escape") {
          this.partsPalette.clearSelection();
          this.closeTooltip();
          this.dragState = null;
          this.placementTarget = null;
          this.partsPalette.setStatus("Placement canceled.");
          return;
        }
        if (this.mode === "build" && event.key === "Delete" && this.selectedPartRef) {
          this.tryDeleteSelectedPart();
        }
      });

      window.addEventListener("keyup", (event) => {
        if (event.code in this.keyState) {
          this.keyState[event.code] = false;
        }
      });

      document.addEventListener("click", (event) => {
        if (event.target === this.renderer.canvas || this.tooltipEl.contains(event.target)) {
          return;
        }
        if (event.target === this.launchButtonEl || event.target === this.recoverButtonEl) {
          return;
        }
        this.closeTooltip();
      });

      this.deleteButtonEl.addEventListener("click", (event) => {
        event.stopPropagation();
        this.tryDeleteSelectedPart();
      });

      this.launchButtonEl.addEventListener("click", () => {
        this.launch();
      });

      this.recoverButtonEl.addEventListener("click", () => {
        this.recover();
      });
    }

    getBuildAnchor() {
      return this.scene.getBuildAnchor(this.renderer.width, this.renderer.height);
    }

    getCanvasPoint(event) {
      const rect = this.renderer.canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    refreshPlacementTarget() {
      const selectedPart = this.partsPalette.getSelectedPart();
      if (!selectedPart || !this.pointer.active || this.mode !== "build") {
        this.placementTarget = null;
        return;
      }
      const anchor = this.getBuildAnchor();
      const maxDistance = selectedPart === "booster" ? 65 : 120;
      this.placementTarget = this.rocketStack.getNearestSnapTarget(
        anchor.x,
        anchor.y,
        selectedPart,
        this.pointer.x,
        this.pointer.y,
        maxDistance
      );
    }

    tryPlaceSelectedPart() {
      const selectedPart = this.partsPalette.getSelectedPart();
      if (!selectedPart) {
        this.partsPalette.setStatus("Select a part first.");
        return;
      }
      const target = this.placementTarget;
      if (!target) {
        this.partsPalette.setStatus("No valid snap point here.");
        return;
      }
      if (this.rocketStack.placePartOnTarget(selectedPart, target)) {
        this.partsPalette.setStatus(`Placed ${PART_DEFS[selectedPart].label}.`);
        this.refreshPlacementTarget();
      } else {
        this.partsPalette.setStatus("That part cannot be placed now.");
      }
    }

    finishDrag() {
      if (!this.dragState || !this.dragState.active) {
        return;
      }
      const drag = this.dragState;
      if (drag.partRef.kind !== "core") {
        return;
      }
      const fromIndex = drag.partRef.index;
      const toIndex = drag.targetIndex;
      if (toIndex == null || fromIndex === toIndex) {
        return;
      }
      if (this.rocketStack.reorderCorePart(fromIndex, toIndex)) {
        this.partsPalette.setStatus("Reordered part.");
        if (this.selectedPartRef && this.selectedPartRef.kind === "core") {
          if (this.selectedPartRef.index === fromIndex) {
            this.selectedPartRef.index = toIndex;
          } else if (fromIndex < toIndex && this.selectedPartRef.index > fromIndex && this.selectedPartRef.index <= toIndex) {
            this.selectedPartRef.index -= 1;
          } else if (
            fromIndex > toIndex &&
            this.selectedPartRef.index >= toIndex &&
            this.selectedPartRef.index < fromIndex
          ) {
            this.selectedPartRef.index += 1;
          }
        }
      } else {
        this.partsPalette.setStatus("Cannot move that part there.");
      }
    }

    tryDeleteSelectedPart() {
      if (!this.selectedPartRef) {
        return;
      }
      if (this.rocketStack.deletePart(this.selectedPartRef)) {
        this.partsPalette.setStatus("Part deleted.");
        this.closeTooltip();
      } else {
        this.partsPalette.setStatus("Cannot delete that part; it would break stack rules.");
      }
    }

    openTooltip(partRect) {
      if (this.mode !== "build") {
        return;
      }
      this.selectedPartRef = {
        kind: partRect.kind,
        index: partRect.index,
        type: partRect.type
      };
      const partDef = PART_DEFS[partRect.type];
      this.tooltipTitleEl.textContent = partDef.label;
      this.tooltipMetaEl.textContent = `${partDef.info}  Mass: ${partDef.mass.toFixed(1)}t`;
      const canDelete = this.rocketStack.canDeletePart(this.selectedPartRef);
      this.deleteButtonEl.disabled = !canDelete;
      const canvasRect = this.renderer.canvas.getBoundingClientRect();
      const tooltipLeft = canvasRect.left + partRect.x + partRect.width + 12;
      const tooltipTop = canvasRect.top + partRect.y - 8;
      this.tooltipEl.style.left = `${Math.min(tooltipLeft, window.innerWidth - 220)}px`;
      this.tooltipEl.style.top = `${Math.max(12, tooltipTop)}px`;
      this.tooltipEl.classList.remove("hidden");
    }

    closeTooltip() {
      this.selectedPartRef = null;
      this.tooltipEl.classList.add("hidden");
    }

    launch() {
      if (this.mode !== "build") {
        return;
      }
      if (!this.rocketStack.isLaunchReady()) {
        this.partsPalette.setStatus("Launch requires at least one engine.");
        return;
      }

      const anchor = this.getBuildAnchor();
      const fuelCapacity = this.rocketStack.getFuelCapacity();
      const dryMass = this.rocketStack.getDryMass();
      const boosterCount = this.rocketStack.countPart("booster");
      const mainEngineCount = this.rocketStack.countPart("engine");
      this.vessel = FlightModel.createVessel({
        x: anchor.x,
        y: anchor.y,
        fuelCapacity,
        dryMass,
        mainEngineCount,
        boosterCount,
        config: this.flightConfig
      });
      this.nozzles = this.rocketStack.getEngineNozzles();
      this.flightCameraBase.x = this.camera.x;
      this.flightCameraBase.y = this.camera.y;

      this.mode = "flight";
      this.closeTooltip();
      this.partsPalette.clearSelection();
      this.partsPalette.setEnabled(false);
      this.partsPalette.setStatus("Flight mode: hold Space to fire, steer with A/D.");
      this.thrustActive = false;
      this.boosterActive = false;
      this.exhaustParticles = [];
      this.particleSpawnCarry = 0;
      this.liftoffPuffDone = false;
      this.syncUiForMode();
    }

    recover() {
      if (this.mode !== "flight") {
        return;
      }
      this.mode = "build";
      this.vessel = null;
      this.nozzles = [];
      this.thrustActive = false;
      this.boosterActive = false;
      this.camera.x = this.flightCameraBase.x;
      this.camera.y = this.flightCameraBase.y;
      this.partsPalette.setEnabled(true);
      this.partsPalette.setStatus("Recovered vessel. Back in build mode.");
      this.launchButtonEl.disabled = !this.rocketStack.isLaunchReady();
      this.syncUiForMode();
    }

    updateFlight(deltaSeconds) {
      if (!this.vessel) {
        return;
      }

      const v = this.vessel;
      const groundY = this.scene.worldGroundY != null ? this.scene.worldGroundY : this.renderer.height - 34;
      const altitudeNow = Math.max(0, groundY - v.y);
      const isGroundedBefore = v.y >= groundY - 2.5;
      this.thrustActive = Boolean(this.keyState.Space && v.fuel > 0 && v.mainThrust > 0);
      this.boosterActive = Boolean(this.keyState.Space && v.boosterFuel > 0 && v.boosterThrust > 0);

      if (this.thrustActive || this.boosterActive) {
        this.spawnExhaust(v, this.nozzles, deltaSeconds);
        if (isGroundedBefore && !this.liftoffPuffDone) {
          this.spawnTakeoffPuff(v);
          this.liftoffPuffDone = true;
        }
      }

      if (!isGroundedBefore) {
        this.liftoffPuffDone = true;
      }

      FlightModel.stepVessel(v, this.keyState, deltaSeconds, { groundY, altitude: altitudeNow }, this.flightConfig);
      this.updateParticles(deltaSeconds, groundY);

      // Always follow horizontally.
      const camera = CameraModel.computeFlightCamera(this.flightCameraBase, v, {
        width: this.renderer.width,
        height: this.renderer.height
      });
      this.camera.x = camera.x;
      this.camera.y = camera.y;

      this.updateFlightHud();
    }

    updateFlightHud() {
      if (!this.vessel) {
        return;
      }
      const altitude = Math.max(0, (this.scene.worldGroundY - this.vessel.y) * 0.45);
      const speed = Math.hypot(this.vessel.vx, this.vessel.vy) * 0.45;
      const fuelPct = this.vessel.fuelCapacity > 0 ? (this.vessel.fuel / this.vessel.fuelCapacity) * 100 : 0;
      const boosterFuelPct = this.vessel.boosterCount > 0 ? (this.vessel.boosterFuel / (this.vessel.boosterCount * this.flightConfig.boosterFuelPerBooster)) * 100 : 0;
      const mass = FlightModel.getCurrentMass(this.vessel);
      const gravity = this.vessel.currentGravity || this.flightConfig.gravity;
      const availableThrust = FlightModel.getAvailableThrust(this.vessel);
      const twr = gravity > 0 ? availableThrust / (mass * gravity) : 0;
      this.hudAltitudeEl.textContent = `Altitude: ${altitude.toFixed(1)} m`;
      this.hudSpeedEl.textContent = `Speed: ${speed.toFixed(1)} m/s`;
      if (this.vessel.boosterCount > 0) {
        this.hudFuelEl.textContent = `Fuel: ${Math.max(0, fuelPct).toFixed(0)}% | Boost: ${Math.max(0, boosterFuelPct).toFixed(0)}%`;
      } else {
        this.hudFuelEl.textContent = `Fuel: ${Math.max(0, fuelPct).toFixed(0)}%`;
      }
      this.hudMassEl.textContent = `Mass: ${mass.toFixed(2)} t`;
      this.hudGravityEl.textContent = `Gravity: ${gravity.toFixed(2)} m/s²`;
      this.hudTwrEl.textContent = `TWR: ${twr.toFixed(2)}`;
    }

    seedStarterRocket() {
      if (this.rocketStack.coreParts.length > 0 || this.rocketStack.boosters.length > 0) {
        return;
      }
      this.rocketStack.placePartOnTarget("engine", { kind: "core" });
      this.rocketStack.placePartOnTarget("fuel_tank", { kind: "core" });
      this.rocketStack.placePartOnTarget("nosecone", { kind: "core" });
      this.partsPalette.setStatus("Starter rocket loaded. Add parts or launch.");
    }

    spawnExhaust(vessel, nozzles, deltaSeconds) {
      if (!nozzles || nozzles.length === 0) {
        return;
      }
      this.particleSpawnCarry += deltaSeconds;
      const intervalSeconds = 0.015;
      const backwardX = -Math.sin(vessel.angle);
      const backwardY = Math.cos(vessel.angle);

      while (this.particleSpawnCarry >= intervalSeconds) {
        this.particleSpawnCarry -= intervalSeconds;
        for (const nozzle of nozzles) {
          const isMain = nozzle.kind === "main";
          if (isMain && !this.thrustActive) {
            continue;
          }
          if (!isMain && !this.boosterActive) {
            continue;
          }
          const worldNozzle = this.rotateLocalPoint(nozzle.x, nozzle.y, vessel.angle, vessel.x, vessel.y);
          this.exhaustParticles.push({
            kind: "flame",
            x: worldNozzle.x + (Math.random() - 0.5) * (isMain ? 6 : 4),
            y: worldNozzle.y + (Math.random() - 0.5) * (isMain ? 6 : 4),
            vx: vessel.vx + backwardX * (isMain ? 98 : 80) + (Math.random() - 0.5) * 18,
            vy: vessel.vy + backwardY * (isMain ? 98 : 80) + (Math.random() - 0.5) * 18,
            life: isMain ? 0.46 + Math.random() * 0.22 : 0.34 + Math.random() * 0.16,
            maxLife: isMain ? 0.46 + Math.random() * 0.22 : 0.34 + Math.random() * 0.16,
            size: isMain ? 2.6 + Math.random() * 1.6 : 1.8 + Math.random() * 1.2
          });
        }
      }
    }

    spawnTakeoffPuff(vessel) {
      const backwardX = -Math.sin(vessel.angle);
      const backwardY = Math.cos(vessel.angle);
      const originX = vessel.x + backwardX * 8;
      const originY = vessel.y + backwardY * 8;
      for (let i = 0; i < 22; i += 1) {
        this.exhaustParticles.push({
          kind: "smoke",
          x: originX + (Math.random() - 0.5) * 12,
          y: originY + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 42 + backwardX * (20 + Math.random() * 30),
          vy: (Math.random() - 0.5) * 28 + backwardY * (20 + Math.random() * 30),
          life: 1 + Math.random() * 0.55,
          maxLife: 1 + Math.random() * 0.55,
          size: 4 + Math.random() * 4
        });
      }
    }

    updateParticles(deltaSeconds, groundY) {
      const next = [];
      for (const p of this.exhaustParticles) {
        p.life -= deltaSeconds;
        if (p.life <= 0) {
          continue;
        }
        p.x += p.vx * deltaSeconds;
        p.y += p.vy * deltaSeconds;
        p.vx *= 0.97;
        p.vy = p.vy * 0.97 + (p.kind === "smoke" ? -8 : 5) * deltaSeconds;
        if (p.y > groundY + 18) {
          p.y = groundY + 18;
          p.vy *= -0.08;
        }
        next.push(p);
      }
      this.exhaustParticles = next.slice(-180);
    }

    rotateLocalPoint(localX, localY, angle, worldX, worldY) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: worldX + localX * cos - localY * sin,
        y: worldY + localX * sin + localY * cos
      };
    }

    syncUiForMode() {
      const inBuild = this.mode === "build";
      this.buildModePanelEl.classList.toggle("hidden", !inBuild);
      this.flightModePanelEl.classList.toggle("hidden", inBuild);
      this.hudPanelEl.classList.toggle("hidden", inBuild);
      if (inBuild) {
        this.launchButtonEl.disabled = !this.rocketStack.isLaunchReady();
      }
    }

    draw() {
      const { ctx, width, height } = this.renderer;
      this.renderer.clear();
      this.scene.draw(ctx, width, height, {
        mode: this.mode,
        rocketStack: this.rocketStack,
        fuelState: this.getFuelState(),
        selectedPart: this.partsPalette.getSelectedPart(),
        pointer: this.pointer,
        selectedPartRef: this.selectedPartRef,
        placementTarget: this.placementTarget,
        dragState: this.dragState,
        vessel: this.vessel,
        camera: this.camera,
        thrustActive: this.thrustActive,
        boosterActive: this.boosterActive,
        exhaustParticles: this.exhaustParticles,
        nozzles: this.nozzles
      });
    }

    getFuelState() {
      if (!this.vessel) {
        return { mainRatio: 1, boosterRatio: 1 };
      }
      const mainRatio = this.vessel.fuelCapacity > 0 ? this.vessel.fuel / this.vessel.fuelCapacity : 0;
      const boosterCapacity = this.vessel.boosterCount * this.flightConfig.boosterFuelPerBooster;
      const boosterRatio = boosterCapacity > 0 ? this.vessel.boosterFuel / boosterCapacity : 0;
      return {
        mainRatio: Math.max(0, Math.min(1, mainRatio)),
        boosterRatio: Math.max(0, Math.min(1, boosterRatio))
      };
    }
  }

  K2D.Game = Game;
})();
