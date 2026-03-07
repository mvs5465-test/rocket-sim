(function () {
  const K2D = window.K2D;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.width = 0;
      this.height = 0;
      this.pixelRatio = window.devicePixelRatio || 1;
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
      this.canvas.width = Math.floor(width * this.pixelRatio);
      this.canvas.height = Math.floor(height * this.pixelRatio);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    }

    clear() {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  K2D.Renderer = Renderer;
})();
