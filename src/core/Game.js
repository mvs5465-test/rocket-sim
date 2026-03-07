export class Game {
  constructor({ renderer, scene, partsPalette }) {
    this.renderer = renderer;
    this.scene = scene;
    this.partsPalette = partsPalette;

    this.lastTimestampMs = 0;
    this.isRunning = false;
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
    this.draw();

    requestAnimationFrame((nextTimestampMs) => this.tick(nextTimestampMs));
  }

  draw() {
    const { ctx, width, height } = this.renderer;
    this.renderer.clear();
    this.scene.draw(ctx, width, height, this.partsPalette.getSelectedPart());
  }
}
