(function () {
  const K2D = window.K2D;
  const PART_DEFS = K2D.PART_DEFS;
  const LaunchPad = K2D.LaunchPad;

  class BuildScene {
    constructor() {
      this.launchPad = new LaunchPad();
      this.worldGroundY = null;
      this.worldPadX = null;
      this.spaceTransitionAltitude = 5000;
      this.cloudLayers = null;
      this.stars = [
        { x: 0.14, y: 0.22, r: 1.3 },
        { x: 0.31, y: 0.17, r: 1.1 },
        { x: 0.47, y: 0.08, r: 1.4 },
        { x: 0.62, y: 0.19, r: 1.2 },
        { x: 0.79, y: 0.11, r: 1.3 },
        { x: 0.9, y: 0.23, r: 1.5 }
      ];
    }

    ensureWorldLayout(width, height) {
      if (this.worldGroundY == null) {
        this.worldGroundY = height - 34;
      }
      if (this.worldPadX == null) {
        this.worldPadX = width * 0.52;
      }
      if (this.cloudLayers == null) {
        this.cloudLayers = this.createCloudLayers();
      }
    }

    getBuildAnchor(width, height) {
      this.ensureWorldLayout(width, height);
      return { x: this.worldPadX, y: this.worldGroundY - this.launchPad.height };
    }

    update(deltaSeconds) {
      if (this.worldPadX == null || !this.cloudLayers) {
        return;
      }
      const minX = this.worldPadX - 2600;
      const maxX = this.worldPadX + 2600;
      for (const layer of this.cloudLayers) {
        for (const cloud of layer.clouds) {
          cloud.x += cloud.speed * deltaSeconds;
          if (cloud.x - cloud.size > maxX) {
            cloud.x = minX;
          }
        }
      }
    }

    draw(ctx, width, height, state) {
      this.ensureWorldLayout(width, height);
      const altitude = state.vessel ? Math.max(0, this.worldGroundY - state.vessel.y) : 0;
      const fullSpace = Math.min(1, altitude / this.spaceTransitionAltitude);
      this.drawSky(ctx, width, height, fullSpace);
      this.drawSun(ctx, width, fullSpace);

      const camera = state.mode === "flight" ? state.camera : { x: 0, y: 0 };
      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      const fuelState = state.fuelState || { mainRatio: 1, boosterRatio: 1 };
      this.drawClouds(ctx, false);
      this.drawGrass(ctx);
      this.drawLaunchPad(ctx, width, height, state);
      this.drawExhaustParticles(ctx, state.exhaustParticles || []);
      if (state.mode === "flight" && state.vessel && (state.thrustActive || state.boosterActive)) {
        this.drawEngineFlames(
          ctx,
          state.vessel,
          state.nozzles || [],
          state.thrustActive,
          state.boosterActive,
          state.currentStage || 1
        );
      }
      if (state.mode === "flight" && state.vessel) {
        state.rocketStack.drawVessel(ctx, state.vessel.x, state.vessel.y, state.vessel.angle, fuelState, {
          includeBoosters: state.includeBoosters !== false,
          minStage: state.minStage || 1,
          excludedBoosterStages: state.excludedBoosterStages || []
        });
      }
      this.drawClouds(ctx, true);
      ctx.restore();
    }

    drawSky(ctx, width, height, fullSpace) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, this.mixColor("#9ed8ff", "#03050a", fullSpace));
      gradient.addColorStop(0.65, this.mixColor("#c9ecff", "#060a12", fullSpace));
      gradient.addColorStop(1, this.mixColor("#def5ff", "#000000", fullSpace));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (fullSpace > 0.05) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * fullSpace})`;
        for (const star of this.stars) {
          ctx.beginPath();
          ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    drawSun(ctx, width, fullSpace) {
      const sunX = Math.max(width - 120, 140);
      const sunY = 90;
      const alpha = Math.max(0, 1 - fullSpace);
      const glow = ctx.createRadialGradient(sunX, sunY, 16, sunX, sunY, 64);
      glow.addColorStop(0, `rgba(255, 242, 184, ${0.95 * alpha})`);
      glow.addColorStop(1, "rgba(255, 242, 184, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 64, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 227, 149, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    drawClouds(ctx, drawFront) {
      if (!this.cloudLayers) {
        return;
      }
      for (const layer of this.cloudLayers) {
        ctx.fillStyle = `rgba(${layer.tint}, ${layer.alpha})`;
        for (const cloud of layer.clouds) {
          if (Boolean(cloud.front) !== Boolean(drawFront)) {
            continue;
          }
          this.drawCloudShape(ctx, layer.style, this.worldPadX + cloud.x, cloud.y, cloud.size);
        }
      }
    }

    drawCloudShape(ctx, style, x, y, size) {
      ctx.beginPath();
      if (style === "bulky-flat") {
        ctx.arc(x - size * 0.35, y - size * 0.08, size * 0.35, Math.PI, 0);
        ctx.arc(x + size * 0.05, y - size * 0.16, size * 0.44, Math.PI, 0);
        ctx.arc(x + size * 0.45, y - size * 0.06, size * 0.33, Math.PI, 0);
        ctx.lineTo(x + size * 0.78, y + size * 0.17);
        ctx.lineTo(x - size * 0.72, y + size * 0.17);
        ctx.closePath();
      } else if (style === "puffy-light") {
        ctx.ellipse(x, y, size * 0.68, size * 0.26, 0, 0, Math.PI * 2);
        ctx.ellipse(x + size * 0.45, y + 5, size * 0.52, size * 0.2, 0, 0, Math.PI * 2);
        ctx.ellipse(x - size * 0.5, y + 7, size * 0.4, size * 0.18, 0, 0, Math.PI * 2);
      } else if (style === "wispy") {
        ctx.ellipse(x, y, size * 0.82, size * 0.18, 0, 0, Math.PI * 2);
        ctx.ellipse(x + size * 0.55, y + 6, size * 0.65, size * 0.14, 0, 0, Math.PI * 2);
        ctx.ellipse(x - size * 0.6, y + 8, size * 0.5, size * 0.12, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(x, y, size * 1.0, size * 0.12, 0, 0, Math.PI * 2);
        ctx.ellipse(x + size * 0.66, y + 4, size * 0.72, size * 0.09, 0, 0, Math.PI * 2);
        ctx.ellipse(x - size * 0.7, y + 5, size * 0.58, size * 0.08, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    createCloudLayer(count, minX, maxX, baseY, ySpread, minSize, maxSize, minSpeed, maxSpeed, frontRate) {
      const clouds = [];
      for (let i = 0; i < count; i += 1) {
        const t = i / Math.max(1, count - 1);
        clouds.push({
          x: minX + (maxX - minX) * t + (Math.random() - 0.5) * 220,
          y: baseY + (Math.random() - 0.5) * ySpread,
          size: minSize + Math.random() * (maxSize - minSize),
          speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
          front: Math.random() < frontRate
        });
      }
      return clouds;
    }

    createCloudLayers() {
      const step = this.spaceTransitionAltitude / 5;
      return [
        {
          style: "bulky-flat",
          tint: "255,255,255",
          alpha: 0.86,
          clouds: this.createCloudLayer(16, -2400, 2400, this.worldGroundY - step * 1, 190, 56, 96, 3.2, 6.1, 0.42)
        },
        {
          style: "puffy-light",
          tint: "244,249,255",
          alpha: 0.68,
          clouds: this.createCloudLayer(10, -2400, 2400, this.worldGroundY - step * 2, 170, 46, 78, 4.9, 8.0, 0.28)
        },
        {
          style: "wispy",
          tint: "232,242,255",
          alpha: 0.54,
          clouds: this.createCloudLayer(6, -2400, 2400, this.worldGroundY - step * 3, 150, 66, 98, 7.5, 11.2, 0.2)
        },
        {
          style: "wispy-streak",
          tint: "220,233,255",
          alpha: 0.46,
          clouds: this.createCloudLayer(4, -2400, 2400, this.worldGroundY - step * 4, 130, 90, 130, 9.4, 13.6, 0.15)
        }
      ];
    }

    drawGrass(ctx) {
      const grassTop = this.worldGroundY - 66;
      const gradient = ctx.createLinearGradient(0, grassTop, 0, this.worldGroundY + 40);
      gradient.addColorStop(0, "#87c96f");
      gradient.addColorStop(1, "#5f9f52");
      ctx.fillStyle = gradient;
      ctx.fillRect(this.worldPadX - 3200, grassTop, 6400, 180);
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(this.worldPadX - 3200, grassTop, 6400, 3);
    }

    drawLaunchPad(ctx, width, height, state) {
      this.launchPad.draw(ctx, this.worldPadX, this.worldGroundY);
      if (state.mode !== "build") {
        return;
      }
      const anchor = this.getBuildAnchor(width, height);
      state.rocketStack.draw(
        ctx,
        anchor.x,
        anchor.y,
        state.selectedPartRef,
        Boolean(state.selectedPart),
        state.fuelState || { mainRatio: 1, boosterRatio: 1 }
      );
      this.drawPlacementPreview(ctx, anchor, state);
      this.drawDragPreview(ctx, anchor, state);
    }

    drawPlacementPreview(ctx, anchor, state) {
      const selectedPart = state.selectedPart;
      if (!selectedPart || !state.pointer.active) {
        return;
      }
      if (state.dragState && state.dragState.active) {
        return;
      }

      const partDef = PART_DEFS[selectedPart];
      const snapTarget = state.placementTarget;
      if (!snapTarget) {
        return;
      }

      state.rocketStack.drawPart(
        ctx,
        selectedPart,
        state.pointer.x,
        state.pointer.y - partDef.height / 2,
        partDef,
        false,
        0.2
      );

      const snapTopY =
        selectedPart === "booster" && snapTarget.kind === "booster"
          ? snapTarget.y
          : snapTarget.y - partDef.height;
      state.rocketStack.drawPart(ctx, selectedPart, snapTarget.x, snapTopY, partDef, true, 0.5);
    }

    drawDragPreview(ctx, anchor, state) {
      const drag = state.dragState;
      if (!drag || !drag.active || drag.partRef.kind !== "core") {
        return;
      }

      const partDef = PART_DEFS[drag.partRef.type];
      state.rocketStack.drawPart(
        ctx,
        drag.partRef.type,
        state.pointer.x,
        state.pointer.y - partDef.height / 2,
        partDef,
        true,
        0.45
      );

      if (drag.targetIndex == null) {
        return;
      }

      const coreRects = state.rocketStack.getCorePartRects(anchor.x, anchor.y);
      const targetRect = coreRects.find((rect) => rect.index === drag.targetIndex);
      if (!targetRect) {
        return;
      }

      ctx.save();
      ctx.strokeStyle = "rgba(47, 126, 161, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(targetRect.x - 18, targetRect.y + targetRect.height / 2);
      ctx.lineTo(targetRect.x + targetRect.width + 18, targetRect.y + targetRect.height / 2);
      ctx.stroke();
      ctx.restore();
    }

    drawEngineFlames(ctx, vessel, nozzles, mainActive, boosterActive, currentStage) {
      for (const nozzle of nozzles) {
        if (nozzle.stage != null && nozzle.stage !== currentStage) {
          continue;
        }
        if (nozzle.kind === "main" && !mainActive) {
          continue;
        }
        if (nozzle.kind === "booster" && !boosterActive) {
          continue;
        }

        const world = this.rotateLocalPoint(nozzle.x, nozzle.y, vessel.angle, vessel.x, vessel.y);
        const outerLen = nozzle.kind === "main" ? 18 + Math.random() * 7 : 12 + Math.random() * 5;
        const innerLen = nozzle.kind === "main" ? 12 + Math.random() * 5 : 8 + Math.random() * 3;
        const outerHalf = nozzle.kind === "main" ? 7 : 5;
        const innerHalf = nozzle.kind === "main" ? 3.5 : 2.4;

        ctx.save();
        ctx.translate(world.x, world.y);
        ctx.rotate(vessel.angle);

        ctx.fillStyle = nozzle.kind === "main" ? "rgba(255, 175, 90, 0.9)" : "rgba(255, 196, 122, 0.85)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-outerHalf, outerLen);
        ctx.lineTo(outerHalf, outerLen);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "rgba(255, 233, 170, 0.82)";
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(-innerHalf, innerLen);
        ctx.lineTo(innerHalf, innerLen);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    drawExhaustParticles(ctx, particles) {
      for (const p of particles) {
        const lifeT = 1 - p.life / p.maxLife;
        const size = p.size * (0.8 + lifeT * 0.9);
        const alpha = p.kind === "smoke" ? 0.45 * (1 - lifeT) : 0.7 * (1 - lifeT);
        if (alpha <= 0) {
          continue;
        }
        ctx.fillStyle = p.kind === "smoke" ? `rgba(180, 188, 198, ${alpha})` : `rgba(245, 180, 95, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    mixColor(hexA, hexB, t) {
      const clampT = Math.max(0, Math.min(1, t));
      const a = this.hexToRgb(hexA);
      const b = this.hexToRgb(hexB);
      const r = Math.round(a.r + (b.r - a.r) * clampT);
      const g = Math.round(a.g + (b.g - a.g) * clampT);
      const bl = Math.round(a.b + (b.b - a.b) * clampT);
      return `rgb(${r}, ${g}, ${bl})`;
    }

    hexToRgb(hex) {
      const clean = hex.replace("#", "");
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16)
      };
    }

    rotateLocalPoint(localX, localY, angle, worldX, worldY) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: worldX + localX * cos - localY * sin,
        y: worldY + localX * sin + localY * cos
      };
    }
  }

  K2D.BuildScene = BuildScene;
})();
