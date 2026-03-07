(function () {
  const K2D = window.K2D;
  const Renderer = K2D.Renderer;
  const BuildScene = K2D.BuildScene;
  const PartsPalette = K2D.PartsPalette;
  const Game = K2D.Game;

  const canvas = document.querySelector("#game-canvas");
  const partsPanel = document.querySelector(".parts-panel");
  const renderer = new Renderer(canvas);
  const scene = new BuildScene();
  const partsPalette = new PartsPalette(partsPanel);
  const game = new Game({ renderer, scene, partsPalette });

  function resize() {
    renderer.resize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener("resize", resize);
  resize();
  game.start();
})();
