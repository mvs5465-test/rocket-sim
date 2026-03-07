(function () {
  const K2D = window.K2D;
  const PART_DEFS = K2D.PART_DEFS;

  class RocketStack {
    constructor() {
      this.coreParts = [];
      this.boosters = [];
      this.boosterOffsetX = 28;
      this.boosterBottomInset = 4;
    }

    static isValidCoreSequence(partTypes) {
      if (partTypes.length === 0) {
        return true;
      }

      for (let i = 0; i < partTypes.length; i += 1) {
        const type = partTypes[i];
        const prev = i > 0 ? partTypes[i - 1] : null;
        if (!PART_DEFS[type]) {
          return false;
        }
        if (i === 0 && type !== "engine") {
          return false;
        }
        if (type === "engine" && i > 0 && prev !== "stage_separator") {
          return false;
        }
        if (type === "stage_separator" && (i === 0 || prev !== "fuel_tank")) {
          return false;
        }
        if (i < partTypes.length - 1 && type === "nosecone") {
          return false;
        }
      }
      return true;
    }

    getCoreTypes() {
      return this.coreParts.map((part) => part.type);
    }

    normalizeStage(stage) {
      const parsed = Number.parseInt(stage, 10);
      if (!Number.isFinite(parsed)) {
        return 1;
      }
      return Math.max(1, Math.min(9, parsed));
    }

    isStageConfigurable(partRef) {
      if (!partRef) {
        return false;
      }
      if (partRef.kind === "booster") {
        return partRef.index >= 0 && partRef.index < this.boosters.length;
      }
      if (partRef.kind === "core") {
        const part = this.coreParts[partRef.index];
        return Boolean(part && part.type === "engine");
      }
      return false;
    }

    getAutoCoreStageByIndex(index) {
      let stage = 1;
      for (let i = 0; i < index && i < this.coreParts.length; i += 1) {
        if (this.coreParts[i].type === "stage_separator") {
          stage += 1;
        }
      }
      return stage;
    }

    syncAutoStages() {
      for (let i = 0; i < this.coreParts.length; i += 1) {
        const part = this.coreParts[i];
        const autoStage = this.getAutoCoreStageByIndex(i);
        if (part.type === "engine") {
          if (!part.stageManual) {
            part.stage = autoStage;
          } else {
            part.stage = this.normalizeStage(part.stage);
          }
          continue;
        }
        part.stage = autoStage;
      }
      for (const booster of this.boosters) {
        const parent = this.coreParts[booster.coreIndex];
        const parentStage = parent ? this.normalizeStage(parent.stage) : 1;
        if (!booster.stageManual) {
          booster.stage = parentStage;
        } else {
          booster.stage = this.normalizeStage(booster.stage);
        }
      }
    }

    getPartStage(partRef) {
      if (!partRef) {
        return 1;
      }
      if (partRef.kind === "core") {
        const part = this.coreParts[partRef.index];
        return part ? this.normalizeStage(part.stage) : 1;
      }
      if (partRef.kind === "booster") {
        const booster = this.boosters[partRef.index];
        return booster ? this.normalizeStage(booster.stage) : 1;
      }
      return 1;
    }

    setPartStage(partRef, stage) {
      const next = this.normalizeStage(stage);
      if (!this.isStageConfigurable(partRef)) {
        return false;
      }
      if (!partRef) {
        return false;
      }
      if (partRef.kind === "core") {
        const part = this.coreParts[partRef.index];
        if (!part) {
          return false;
        }
        part.stage = next;
        part.stageManual = true;
        return true;
      }
      if (partRef.kind === "booster") {
        const booster = this.boosters[partRef.index];
        if (!booster) {
          return false;
        }
        booster.stage = next;
        booster.stageManual = true;
        return true;
      }
      return false;
    }

    getTopY(anchorY) {
      return anchorY - this.coreParts.reduce((sum, part) => sum + PART_DEFS[part.type].height, 0);
    }

    getCorePartRects(anchorX, anchorY) {
      const rects = [];
      let cursorY = anchorY;
      for (let i = 0; i < this.coreParts.length; i += 1) {
        const part = this.coreParts[i];
        const partDef = PART_DEFS[part.type];
        const topY = cursorY - partDef.height;
        rects.push({
          kind: "core",
          index: i,
          type: part.type,
          stage: this.normalizeStage(part.stage),
          x: anchorX - partDef.width / 2,
          y: topY,
          width: partDef.width,
          height: partDef.height,
          centerX: anchorX,
          topY
        });
        cursorY = topY;
      }
      return rects;
    }

    getBoosterSlots(anchorX, anchorY) {
      const slots = [];
      const coreRects = this.getCorePartRects(anchorX, anchorY);
      for (const coreRect of coreRects) {
        if (coreRect.type !== "fuel_tank") {
          continue;
        }
        slots.push({
          kind: "booster_slot",
          coreIndex: coreRect.index,
          side: "left",
          x: coreRect.centerX - this.boosterOffsetX,
          y: coreRect.y + coreRect.height / 2
        });
        slots.push({
          kind: "booster_slot",
          coreIndex: coreRect.index,
          side: "right",
          x: coreRect.centerX + this.boosterOffsetX,
          y: coreRect.y + coreRect.height / 2
        });
      }
      return slots;
    }

    hasBooster(coreIndex, side) {
      return this.boosters.some((booster) => booster.coreIndex === coreIndex && booster.side === side);
    }

    countOpenBoosterSlots() {
      let total = 0;
      for (let i = 0; i < this.coreParts.length; i += 1) {
        if (this.coreParts[i].type !== "fuel_tank") {
          continue;
        }
        if (!this.hasBooster(i, "left")) {
          total += 1;
        }
        if (!this.hasBooster(i, "right")) {
          total += 1;
        }
      }
      return total;
    }

    countPart(type) {
      if (type === "booster") {
        return this.boosters.length;
      }
      return this.coreParts.filter((part) => part.type === type).length;
    }

    hasCorePart(type) {
      return this.coreParts.some((part) => part.type === type);
    }

    isLaunchReady() {
      if (!this.hasCorePart("engine")) {
        return false;
      }
      const topType = this.coreParts.length > 0 ? this.coreParts[this.coreParts.length - 1].type : null;
      if (topType === "stage_separator") {
        return false;
      }
      for (let i = 0; i < this.coreParts.length; i += 1) {
        if (this.coreParts[i].type !== "stage_separator") {
          continue;
        }
        if (i >= this.coreParts.length - 1 || this.coreParts[i + 1].type !== "engine") {
          return false;
        }
      }
      return true;
    }

    getDryMass() {
      let mass = 0;
      for (const part of this.coreParts) {
        mass += PART_DEFS[part.type].mass;
      }
      for (const booster of this.boosters) {
        if (booster) {
          mass += PART_DEFS.booster.mass;
        }
      }
      return Math.max(1, mass);
    }

    getFuelCapacity() {
      const tankCount = this.countPart("fuel_tank");
      return 30 + tankCount * 45;
    }

    getBoosterRects(anchorX, anchorY, options) {
      const opts = options || {};
      if (opts.includeBoosters === false) {
        return [];
      }
      const boosterDef = PART_DEFS.booster;
      const coreRects = this.getCorePartRects(anchorX, anchorY);
      const rects = [];
      for (let i = 0; i < this.boosters.length; i += 1) {
        const booster = this.boosters[i];
        const parent = coreRects.find((rect) => rect.index === booster.coreIndex);
        if (!parent) {
          continue;
        }
        if (typeof opts.minStage === "number" && this.normalizeStage(booster.stage) < opts.minStage) {
          continue;
        }
        if (Array.isArray(opts.excludedBoosterStages) && opts.excludedBoosterStages.includes(this.normalizeStage(booster.stage))) {
          continue;
        }
        const centerX = parent.centerX + (booster.side === "left" ? -this.boosterOffsetX : this.boosterOffsetX);
        const topY = parent.y + parent.height / 2 + this.boosterBottomInset;
        rects.push({
          kind: "booster",
          index: i,
          type: "booster",
          coreIndex: booster.coreIndex,
          side: booster.side,
          stage: this.normalizeStage(booster.stage),
          x: centerX - boosterDef.width / 2,
          y: topY,
          width: boosterDef.width,
          height: boosterDef.height,
          centerX,
          topY
        });
      }
      return rects;
    }

    getAllPartRects(anchorX, anchorY, options) {
      const opts = options || {};
      const coreRects = this.getCorePartRects(anchorX, anchorY).filter((rect) => {
        if (typeof opts.minStage !== "number") {
          return true;
        }
        return rect.stage >= opts.minStage;
      });
      return [...coreRects, ...this.getBoosterRects(anchorX, anchorY, options)];
    }

    getVesselPartRects(options) {
      return this.getAllPartRects(0, 0, options);
    }

    getEngineNozzles(options) {
      const opts = options || {};
      const nozzles = [];
      const coreRects = this.getCorePartRects(0, 0);
      const boosterRects = this.getBoosterRects(0, 0, options);

      for (const rect of coreRects) {
        if (rect.type === "engine") {
          const corePart = this.coreParts[rect.index];
          nozzles.push({
            kind: "main",
            stage: this.normalizeStage(corePart && corePart.stage),
            x: rect.centerX,
            y: rect.y + rect.height
          });
        }
      }

      for (const rect of boosterRects) {
        if (opts.activeBoosterStages && !opts.activeBoosterStages.includes(rect.stage)) {
          continue;
        }
        nozzles.push({ kind: "booster", stage: rect.stage, x: rect.centerX, y: rect.y + rect.height });
      }

      return nozzles;
    }

    findPartAt(anchorX, anchorY, pointerX, pointerY) {
      const rects = this.getAllPartRects(anchorX, anchorY);
      for (let i = rects.length - 1; i >= 0; i -= 1) {
        const rect = rects[i];
        const insideX = pointerX >= rect.x && pointerX <= rect.x + rect.width;
        const insideY = pointerY >= rect.y && pointerY <= rect.y + rect.height;
        if (insideX && insideY) {
          return rect;
        }
      }
      return null;
    }

    canPlacePart(partType) {
      if (!PART_DEFS[partType]) {
        return false;
      }
      if (partType === "booster") {
        return this.countOpenBoosterSlots() > 0;
      }
      return RocketStack.isValidCoreSequence([...this.getCoreTypes(), partType]);
    }

    getAvailableBoosterSlots(anchorX, anchorY) {
      const slots = anchorX == null || anchorY == null ? [] : this.getBoosterSlots(anchorX, anchorY);
      return slots.filter((slot) => !this.hasBooster(slot.coreIndex, slot.side));
    }

    getSnapTargets(anchorX, anchorY, partType) {
      if (!this.canPlacePart(partType)) {
        return [];
      }
      if (partType === "booster") {
        return this.getAvailableBoosterSlots(anchorX, anchorY).map((slot) => ({
          kind: "booster",
          x: slot.x,
          y: slot.y,
          coreIndex: slot.coreIndex,
          side: slot.side
        }));
      }
      return [{ kind: "core", x: anchorX, y: this.getTopY(anchorY) }];
    }

    getNearestSnapTarget(anchorX, anchorY, partType, pointerX, pointerY, maxDistance) {
      const targets = this.getSnapTargets(anchorX, anchorY, partType);
      let best = null;
      let bestDistance = Infinity;
      for (const target of targets) {
        const distance = Math.hypot(pointerX - target.x, pointerY - target.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = target;
        }
      }
      if (!best) {
        return null;
      }
      if (typeof maxDistance === "number" && bestDistance > maxDistance) {
        return null;
      }
      return best;
    }

    placePartOnTarget(partType, target) {
      if (!target || !this.canPlacePart(partType)) {
        return false;
      }
      if (partType === "booster") {
        if (target.kind !== "booster" || target.coreIndex == null || !target.side) {
          return false;
        }
        if (this.hasBooster(target.coreIndex, target.side)) {
          return false;
        }
        const parent = this.coreParts[target.coreIndex];
        this.boosters.push({
          coreIndex: target.coreIndex,
          side: target.side,
          stage: parent ? this.normalizeStage(parent.stage) : 1,
          stageManual: false
        });
        this.syncAutoStages();
        return true;
      }
      if (target.kind !== "core") {
        return false;
      }
      const coreIndex = this.coreParts.length;
      const autoStage = this.getAutoCoreStageByIndex(coreIndex);
      this.coreParts.push({
        type: partType,
        stage: autoStage,
        stageManual: false
      });
      this.syncAutoStages();
      return true;
    }

    canDeletePart(partRef) {
      if (!partRef) {
        return false;
      }
      if (partRef.kind === "booster") {
        return partRef.index >= 0 && partRef.index < this.boosters.length;
      }
      if (partRef.kind !== "core") {
        return false;
      }
      const index = partRef.index;
      if (index < 0 || index >= this.coreParts.length) {
        return false;
      }
      if (this.boosters.some((booster) => booster.coreIndex === index)) {
        return false;
      }
      const nextTypes = this.getCoreTypes().filter((_, idx) => idx !== index);
      return RocketStack.isValidCoreSequence(nextTypes);
    }

    deletePart(partRef) {
      if (!this.canDeletePart(partRef)) {
        return false;
      }
      if (partRef.kind === "booster") {
        this.boosters.splice(partRef.index, 1);
        this.syncAutoStages();
        return true;
      }

      this.coreParts.splice(partRef.index, 1);
      this.boosters = this.boosters
        .filter((booster) => booster.coreIndex !== partRef.index)
        .map((booster) => ({
          coreIndex: booster.coreIndex > partRef.index ? booster.coreIndex - 1 : booster.coreIndex,
          side: booster.side,
          stage: booster.stage,
          stageManual: Boolean(booster.stageManual)
        }));
      this.syncAutoStages();
      return true;
    }

    canReorderCorePart(fromIndex, toIndex) {
      if (fromIndex === toIndex) {
        return false;
      }
      if (fromIndex < 0 || fromIndex >= this.coreParts.length || toIndex < 0 || toIndex >= this.coreParts.length) {
        return false;
      }
      if (this.boosters.some((booster) => booster.coreIndex === fromIndex)) {
        return false;
      }

      const nextTypes = this.getCoreTypes();
      const [moved] = nextTypes.splice(fromIndex, 1);
      nextTypes.splice(toIndex, 0, moved);
      return RocketStack.isValidCoreSequence(nextTypes);
    }

    reorderCorePart(fromIndex, toIndex) {
      if (!this.canReorderCorePart(fromIndex, toIndex)) {
        return false;
      }
      const [moved] = this.coreParts.splice(fromIndex, 1);
      this.coreParts.splice(toIndex, 0, moved);
      this.syncAutoStages();
      return true;
    }

    getReorderIndexForPointer(anchorX, anchorY, pointerY) {
      const coreRects = this.getCorePartRects(anchorX, anchorY);
      if (coreRects.length === 0) {
        return null;
      }
      let bestIndex = coreRects[0].index;
      let bestDistance = Infinity;
      for (const rect of coreRects) {
        const centerY = rect.y + rect.height / 2;
        const distance = Math.abs(pointerY - centerY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = rect.index;
        }
      }
      return bestIndex;
    }

    getCompartmentByCoreIndex() {
      const map = [];
      let compartment = 0;
      for (let i = 0; i < this.coreParts.length; i += 1) {
        const part = this.coreParts[i];
        map[i] = compartment;
        if (part.type === "stage_separator") {
          compartment += 1;
        }
      }
      return map;
    }

    getFlightSetup() {
      this.syncAutoStages();
      const compartmentByCoreIndex = this.getCompartmentByCoreIndex();
      const fuelCompartments = [];
      const ensureCompartment = (idx) => {
        while (fuelCompartments.length <= idx) {
          fuelCompartments.push({ fuel: 0, capacity: 0 });
        }
      };

      const mainEngines = [];
      let firstEngineCompartment = 0;
      for (let i = 0; i < this.coreParts.length; i += 1) {
        const part = this.coreParts[i];
        const compartment = compartmentByCoreIndex[i] || 0;
        ensureCompartment(compartment);
        if (part.type === "engine") {
          if (mainEngines.length === 0) {
            firstEngineCompartment = compartment;
          }
          mainEngines.push({ stage: this.normalizeStage(part.stage), compartment });
        }
        if (part.type === "fuel_tank") {
          fuelCompartments[compartment].fuel += 45;
          fuelCompartments[compartment].capacity += 45;
        }
      }

      ensureCompartment(firstEngineCompartment);
      fuelCompartments[firstEngineCompartment].fuel += 30;
      fuelCompartments[firstEngineCompartment].capacity += 30;

      const boosterUnits = this.boosters.map((booster) => ({
        stage: this.normalizeStage(booster.stage),
        dryMass: PART_DEFS.booster.mass
      }));

      const coreStageMasses = [];
      for (let i = 0; i < this.coreParts.length; i += 1) {
        const part = this.coreParts[i];
        const stage = this.normalizeStage(part.stage);
        while (coreStageMasses.length < stage) {
          coreStageMasses.push(0);
        }
        coreStageMasses[stage - 1] += PART_DEFS[part.type].mass;
      }

      return {
        mainEngines,
        fuelCompartments,
        boosterUnits,
        coreStageMasses
      };
    }

    draw(ctx, anchorX, anchorY, selectedPartRef, showBoosterSlots, fuelState) {
      if (showBoosterSlots) {
        this.drawBoosterSlots(ctx, anchorX, anchorY);
      }

      const boosterRects = this.getBoosterRects(anchorX, anchorY);
      for (const rect of boosterRects) {
        const selected =
          selectedPartRef && selectedPartRef.kind === "booster" && selectedPartRef.index === rect.index;
        this.drawPart(ctx, "booster", rect.centerX, rect.topY, PART_DEFS.booster, rect.stage, selected, 1, fuelState);
      }

      for (const rect of this.getCorePartRects(anchorX, anchorY)) {
        const selected = selectedPartRef && selectedPartRef.kind === "core" && selectedPartRef.index === rect.index;
        this.drawPart(ctx, rect.type, rect.centerX, rect.topY, PART_DEFS[rect.type], rect.stage, selected, 1, fuelState);
      }
    }

    drawVessel(ctx, worldX, worldY, angle, fuelState, options) {
      const vesselRects = this.getVesselPartRects(options);
      ctx.save();
      ctx.translate(worldX, worldY);
      ctx.rotate(angle);
      for (const rect of vesselRects) {
        this.drawPart(ctx, rect.type, rect.centerX, rect.topY, PART_DEFS[rect.type], rect.stage, false, 1, fuelState);
      }
      ctx.restore();
    }

    drawBoosterSlots(ctx, anchorX, anchorY) {
      const slots = this.getBoosterSlots(anchorX, anchorY);
      for (const slot of slots) {
        const occupied = this.hasBooster(slot.coreIndex, slot.side);
        ctx.save();
        ctx.fillStyle = occupied ? "rgba(80, 90, 100, 0.2)" : "rgba(47, 126, 161, 0.25)";
        ctx.strokeStyle = occupied ? "rgba(80, 90, 100, 0.4)" : "rgba(47, 126, 161, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    drawPart(ctx, partType, centerX, topY, partDef, partStage, outlined, alpha, fuelState) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const stage = this.normalizeStage(partStage);

      if (partType === "fuel_tank") {
        ctx.fillStyle = "#f4f7fa";
        ctx.strokeStyle = outlined ? "#2f7ea1" : "#8b95a3";
        ctx.lineWidth = outlined ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(centerX - partDef.width / 2, topY, partDef.width, partDef.height, 6);
        ctx.fill();
        ctx.stroke();
        const stageRatio = fuelState && fuelState.mainByStage ? fuelState.mainByStage[stage] : null;
        this.drawFuelWindow(ctx, centerX - 5, topY + 7, 10, partDef.height - 14, stageRatio == null ? 1 : stageRatio);
      }

      if (partType === "engine") {
        ctx.fillStyle = "#d9dee5";
        ctx.strokeStyle = outlined ? "#2f7ea1" : "#7d8592";
        ctx.lineWidth = outlined ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(centerX - partDef.width / 2, topY, partDef.width, 20, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#8a9099";
        ctx.beginPath();
        ctx.moveTo(centerX - 10, topY + 20);
        ctx.lineTo(centerX + 10, topY + 20);
        ctx.lineTo(centerX + 6, topY + partDef.height);
        ctx.lineTo(centerX - 6, topY + partDef.height);
        ctx.closePath();
        ctx.fill();
      }

      if (partType === "nosecone") {
        ctx.fillStyle = "#eaf0f6";
        ctx.strokeStyle = outlined ? "#2f7ea1" : "#8b95a3";
        ctx.lineWidth = outlined ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(centerX, topY);
        ctx.lineTo(centerX + partDef.width / 2, topY + partDef.height);
        ctx.lineTo(centerX - partDef.width / 2, topY + partDef.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (partType === "booster") {
        ctx.fillStyle = "#e3e8ef";
        ctx.strokeStyle = outlined ? "#2f7ea1" : "#7f8895";
        ctx.lineWidth = outlined ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(centerX - partDef.width / 2, topY, partDef.width, partDef.height - 8, 4);
        ctx.fill();
        ctx.stroke();
        this.drawFuelWindow(
          ctx,
          centerX - 2.5,
          topY + 6,
          5,
          partDef.height - 18,
          fuelState && fuelState.boosterByStage && fuelState.boosterByStage[stage] != null
            ? fuelState.boosterByStage[stage]
            : fuelState && fuelState.boosterRatio != null
              ? fuelState.boosterRatio
              : 1
        );
        ctx.fillStyle = "#88909d";
        ctx.beginPath();
        ctx.moveTo(centerX - 5, topY + partDef.height - 8);
        ctx.lineTo(centerX + 5, topY + partDef.height - 8);
        ctx.lineTo(centerX + 3, topY + partDef.height);
        ctx.lineTo(centerX - 3, topY + partDef.height);
        ctx.closePath();
        ctx.fill();
      }

      if (partType === "stage_separator") {
        ctx.fillStyle = "#c7ced8";
        ctx.strokeStyle = outlined ? "#2f7ea1" : "#6e7784";
        ctx.lineWidth = outlined ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(centerX - partDef.width / 2, topY + 1, partDef.width, partDef.height - 2, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#6e7784";
        ctx.fillRect(centerX - partDef.width / 2 + 3, topY + partDef.height / 2 - 1, partDef.width - 6, 2);
      }

      ctx.restore();
    }

    drawFuelWindow(ctx, x, y, width, height, ratio) {
      const clamped = Math.max(0, Math.min(1, ratio == null ? 1 : ratio));
      ctx.fillStyle = "#12161c";
      ctx.fillRect(x, y, width, height);
      const innerX = x + 1;
      const innerY = y + 1;
      const innerW = Math.max(0, width - 2);
      const innerH = Math.max(0, height - 2);
      const fillHeight = Math.max(0, Math.floor(innerH * clamped));
      if (fillHeight > 0) {
        const grad = ctx.createLinearGradient(0, y + height, 0, y);
        grad.addColorStop(0, "#49b95d");
        grad.addColorStop(1, "#8de06c");
        ctx.fillStyle = grad;
        ctx.fillRect(innerX, innerY + innerH - fillHeight, innerW, fillHeight);
      }
      ctx.strokeStyle = "rgba(157, 169, 183, 0.65)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
    }
  }

  K2D.RocketStack = RocketStack;
})();
