import { LaunchPad } from "../world/LaunchPad.js";

export class BuildScene {
  constructor() {
    this.launchPad = new LaunchPad();
    this.clouds = [
      { x: 180, y: 90, size: 50, speed: 6 },
      { x: 380, y: 130, size: 36, speed: 4 },
      { x: 640, y: 75, size: 44, speed: 5 }
    ];
  }

  update(deltaSeconds, viewportWidth) {
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * deltaSeconds;
      if (cloud.x - cloud.size > viewportWidth + 40) {
        cloud.x = -80;
      }
    }
  }

  draw(ctx, width, height) {
    this.drawSky(ctx, width, height);
    this.drawSun(ctx, width);
    this.drawClouds(ctx);
    this.drawGrass(ctx, width, height);
    this.drawLaunchPad(ctx, width, height);
  }

  drawSky(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#9ed8ff");
    gradient.addColorStop(0.65, "#c9ecff");
    gradient.addColorStop(1, "#def5ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  drawSun(ctx, width) {
    const sunX = Math.max(width - 120, 140);
    const sunY = 90;
    const glow = ctx.createRadialGradient(sunX, sunY, 16, sunX, sunY, 64);
    glow.addColorStop(0, "rgba(255, 242, 184, 0.95)");
    glow.addColorStop(1, "rgba(255, 242, 184, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 64, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffe395";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  drawClouds(ctx) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (const cloud of this.clouds) {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.size * 0.4, cloud.y + 8, cloud.size * 0.42, 0, Math.PI * 2);
      ctx.arc(cloud.x - cloud.size * 0.45, cloud.y + 10, cloud.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawGrass(ctx, width, height) {
    const grassTop = height - 100;
    const gradient = ctx.createLinearGradient(0, grassTop, 0, height);
    gradient.addColorStop(0, "#87c96f");
    gradient.addColorStop(1, "#5f9f52");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, grassTop, width, 100);

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(0, grassTop, width, 3);
  }

  drawLaunchPad(ctx, width, height) {
    const groundY = height - 34;
    this.launchPad.draw(ctx, width * 0.52, groundY);
  }
}
