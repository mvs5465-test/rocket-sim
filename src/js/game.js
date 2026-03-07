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
      this.tooltipStageRowEl = document.querySelector("#tooltip-stage-row");
      this.tooltipStageEl = document.querySelector("#tooltip-stage");
      this.stageDownButtonEl = document.querySelector("#stage-down-button");
      this.stageUpButtonEl = document.querySelector("#stage-up-button");
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
      this.hudStageEl = document.querySelector("#hud-stage");
      this.hudStatusEl = document.querySelector("#hud-status");

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

        if (this.mode === "flight" && event.code === "KeyE" && !event.repeat) {
          event.preventDefault();
          this.activateStage();
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

      if (this.stageDownButtonEl) {
        this.stageDownButtonEl.addEventListener("click", (event) => {
          event.stopPropagation();
          this.shiftSelectedPartStage(-1);
        });
      }

      if (this.stageUpButtonEl) {
        this.stageUpButtonEl.addEventListener("click", (event) => {
          event.stopPropagation();
          this.shiftSelectedPartStage(1);
        });
      }

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
      this.updateTooltipStageUi();
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

    shiftSelectedPartStage(delta) {
      if (this.mode !== "build" || !this.selectedPartRef) {
        return;
      }
      const current = this.rocketStack.getPartStage(this.selectedPartRef);
      const changed = this.rocketStack.setPartStage(this.selectedPartRef, current + delta);
      if (!changed) {
        return;
      }
      this.updateTooltipStageUi();
      this.partsPalette.setStatus(`Assigned to stage ${this.rocketStack.getPartStage(this.selectedPartRef)}.`);
    }

    updateTooltipStageUi() {
      if (!this.selectedPartRef || !this.tooltipStageEl) {
        return;
      }
      const configurable = this.rocketStack.isStageConfigurable(this.selectedPartRef);
      if (this.tooltipStageRowEl) {
        this.tooltipStageRowEl.classList.toggle("hidden", !configurable);
      }
      if (!configurable) {
        return;
      }
      const stage = this.rocketStack.getPartStage(this.selectedPartRef);
      this.tooltipStageEl.textContent = `Stage: ${stage}`;
      if (this.stageDownButtonEl) {
        this.stageDownButtonEl.disabled = stage <= 1;
      }
      if (this.stageUpButtonEl) {
        this.stageUpButtonEl.disabled = stage >= 9;
      }
    }

    launch() {
      if (this.mode !== "build") {
        return;
      }
      if (!this.rocketStack.isLaunchReady()) {
        this.partsPalette.setStatus("Launch requires a valid stack. Finish any open stage.");
        return;
      }

      const anchor = this.getBuildAnchor();
      const dryMass = this.rocketStack.getDryMass();
      const flightSetup = this.rocketStack.getFlightSetup();
      this.vessel = FlightModel.createVessel({
        x: anchor.x,
        y: anchor.y,
        dryMass,
        mainEngines: flightSetup.mainEngines,
        fuelCompartments: flightSetup.fuelCompartments,
        boosterUnits: flightSetup.boosterUnits,
        coreStageMasses: flightSetup.coreStageMasses,
        config: this.flightConfig
      });
      this.nozzles = this.rocketStack.getEngineNozzles();
      this.flightCameraBase.x = this.camera.x;
      this.flightCameraBase.y = this.camera.y;

      this.mode = "flight";
      this.closeTooltip();
      this.partsPalette.clearSelection();
      this.partsPalette.setEnabled(false);
      this.partsPalette.setStatus("Flight mode: hold Space to fire, steer with A/D, press E to stage.");
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
      const canPropel = v.flightState !== "crashed";
      this.thrustActive = Boolean(canPropel && this.keyState.Space && v.mainThrust > 0);
      this.boosterActive = Boolean(canPropel && this.keyState.Space && v.boosterThrust > 0);

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

      // Follow vessel COM instead of stack base so post-separation framing/pivot feels correct.
      const cameraTarget = this.getCameraTargetForVessel(v);
      const camera = CameraModel.computeFlightCamera(this.flightCameraBase, cameraTarget, {
        width: this.renderer.width,
        height: this.renderer.height
      });
      this.camera.x = camera.x;
      this.camera.y = camera.y;

      this.updateFlightHud();
    }

    getCameraTargetForVessel(vessel) {
      const stageHeightPixels = 78;
      const centerOfMassY = typeof vessel.centerOfMassY === "number" ? vessel.centerOfMassY : 1;
      const maxOffset = 240;
      const offsetY = Math.max(0, Math.min(maxOffset, (centerOfMassY - 1) * stageHeightPixels));
      const comOffsetX = Math.sin(vessel.angle) * offsetY;
      const comOffsetY = -Math.cos(vessel.angle) * offsetY;
      return {
        x: vessel.x + comOffsetX,
        y: vessel.y + comOffsetY
      };
    }

    activateStage() {
      if (this.mode !== "flight" || !this.vessel) {
        return;
      }
      if (this.vessel.flightState === "crashed") {
        this.partsPalette.setStatus("Cannot stage after crash.");
        return;
      }
      const eventResult = FlightModel.activateNextStage(this.vessel);
      if (!eventResult.ok) {
        this.partsPalette.setStatus("No remaining stage.");
        return;
      }
      if (eventResult.type === "jettison_boosters") {
        this.partsPalette.setStatus(`Booster separation: stage ${eventResult.stage}.`);
      } else {
        this.partsPalette.setStatus(`Activated stage ${this.vessel.currentStage}.`);
      }
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
      const statusLabel =
        this.vessel.flightState === "crashed"
          ? "Crashed"
          : this.vessel.flightState === "landed"
            ? "Landed"
            : "Flying";
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
      if (this.hudStageEl) {
        this.hudStageEl.textContent = `Stage: ${this.vessel.currentStage}`;
      }
      if (this.hudStatusEl) {
        this.hudStatusEl.textContent = `Status: ${statusLabel}`;
      }
    }

    seedStarterRocket() {
      if (this.rocketStack.coreParts.length > 0 || this.rocketStack.boosters.length > 0) {
        return;
      }
      const anchorX = 0;
      const anchorY = 0;
      const placeCorePart = (partType) => {
        const target = this.rocketStack.getSnapTargets(anchorX, anchorY, partType)[0];
        return target ? this.rocketStack.placePartOnTarget(partType, target) : false;
      };
      const placeBoosterOn = (coreIndex, side) => {
        const targets = this.rocketStack.getSnapTargets(anchorX, anchorY, "booster");
        const target = targets.find((t) => t.coreIndex === coreIndex && t.side === side);
        return target ? this.rocketStack.placePartOnTarget("booster", target) : false;
      };

      // Bottom stage: engine + dual tanks + side boosters.
      placeCorePart("engine");
      placeCorePart("fuel_tank");
      placeCorePart("fuel_tank");
      placeBoosterOn(1, "left");
      placeBoosterOn(1, "right");

      // Upper stage: separator + upper engine + tank + nosecone.
      placeCorePart("stage_separator");
      placeCorePart("engine");
      placeCorePart("fuel_tank");
      placeCorePart("nosecone");

      this.partsPalette.setStatus("Two-stage starter rocket loaded. Press E in flight to stage.");
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
          if (nozzle.stage != null && nozzle.stage !== vessel.currentStage) {
            continue;
          }
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
        nozzles: this.nozzles,
        includeBoosters: !this.vessel || this.vessel.boosterAttached,
        currentStage: this.vessel ? this.vessel.currentStage : 1,
        minStage: this.vessel ? this.vessel.currentStage : 1,
        excludedBoosterStages: this.vessel ? this.vessel.detachedBoosterStages : []
      });
    }

    getFuelState() {
      if (!this.vessel) {
        return { mainRatio: 1, boosterRatio: 1, mainByStage: {}, boosterByStage: {} };
      }
      const mainRatio = this.vessel.fuelCapacity > 0 ? this.vessel.fuel / this.vessel.fuelCapacity : 0;
      const boosterCapacity = this.vessel.boosterCount * this.flightConfig.boosterFuelPerBooster;
      const boosterRatio = boosterCapacity > 0 ? this.vessel.boosterFuel / boosterCapacity : 0;
      const mainByStage = {};
      if (Array.isArray(this.vessel.fuelCompartments)) {
        for (let i = 0; i < this.vessel.fuelCompartments.length; i += 1) {
          const c = this.vessel.fuelCompartments[i];
          const stage = i + 1;
          mainByStage[stage] = c && c.capacity > 0 ? Math.max(0, Math.min(1, c.fuel / c.capacity)) : 0;
        }
      }
      const boosterByStage = {};
      if (Array.isArray(this.vessel.boosterUnits)) {
        const grouped = {};
        for (const unit of this.vessel.boosterUnits) {
          const stage = unit.stage || 1;
          if (!grouped[stage]) {
            grouped[stage] = { fuel: 0, capacity: 0 };
          }
          grouped[stage].fuel += Math.max(0, unit.fuel || 0);
          grouped[stage].capacity += this.flightConfig.boosterFuelPerBooster;
        }
        for (const key of Object.keys(grouped)) {
          const group = grouped[key];
          boosterByStage[key] = group.capacity > 0 ? Math.max(0, Math.min(1, group.fuel / group.capacity)) : 0;
        }
      }
      return {
        mainRatio: Math.max(0, Math.min(1, mainRatio)),
        boosterRatio: Math.max(0, Math.min(1, boosterRatio)),
        mainByStage,
        boosterByStage
      };
    }
  }

  K2D.Game = Game;
})();
