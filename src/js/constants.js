window.K2D = window.K2D || {};

window.K2D.PART_DEFS = {
  engine: { label: "engine", width: 34, height: 34, mass: 1.2, info: "Provides thrust at launch." },
  fuel_tank: { label: "fuel tank", width: 30, height: 42, mass: 1.8, info: "Stores fuel for the engine." },
  stage_separator: { label: "stage separator", width: 30, height: 10, mass: 0.25, info: "Connects stacked engine stages." },
  nosecone: { label: "nosecone", width: 30, height: 24, mass: 0.4, info: "Aerodynamic top cap." },
  booster: { label: "booster", width: 16, height: 36, mass: 0.9, info: "Side-mounted auxiliary thrust." }
};
