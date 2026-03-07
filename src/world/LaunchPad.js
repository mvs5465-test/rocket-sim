export class LaunchPad {
  constructor() {
    this.width = 200;
    this.height = 12;
    this.towerWidth = 16;
    this.towerHeight = 74;
  }

  draw(ctx, x, y) {
    ctx.save();

    ctx.fillStyle = "#8e939c";
    ctx.fillRect(x - this.width / 2, y - this.height, this.width, this.height);

    ctx.fillStyle = "#727982";
    ctx.fillRect(x - this.towerWidth / 2, y - this.height - this.towerHeight, this.towerWidth, this.towerHeight);

    ctx.fillStyle = "#626871";
    ctx.fillRect(x - 4, y - this.height - this.towerHeight - 30, 8, 30);

    ctx.restore();
  }
}
