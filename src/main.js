import { Game } from "./core/Game.js";
import { Renderer } from "./core/Renderer.js";
import { BuildScene } from "./scenes/BuildScene.js";
import { PartsPalette } from "./ui/PartsPalette.js";

function bootstrap() {
  const canvas = document.querySelector("#game-canvas");
  const partsPanel = document.querySelector(".parts-panel");

  if (!canvas || !partsPanel) {
    throw new Error("Missing required DOM elements for game bootstrap.");
  }

  const renderer = new Renderer(canvas);
  const scene = new BuildScene();
  const partsPalette = new PartsPalette(partsPanel);
  const game = new Game({ renderer, scene, partsPalette });

  const resize = () => {
    renderer.resize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener("resize", resize);
  resize();
  game.start();
}

bootstrap();
