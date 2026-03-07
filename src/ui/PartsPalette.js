const PART_LABELS = {
  engine: "engine",
  fuel_tank: "fuel tank",
  nosecone: "nosecone"
};

export class PartsPalette {
  constructor(rootElement) {
    this.rootElement = rootElement;
    this.selectionLabel = rootElement.querySelector("#selection-label");
    this.buttons = Array.from(rootElement.querySelectorAll(".part-button"));
    this.selectedPart = null;

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    for (const button of this.buttons) {
      button.addEventListener("click", () => {
        const part = button.dataset.part;
        this.selectedPart = this.selectedPart === part ? null : part;
        this.render();
      });
    }
  }

  getSelectedPart() {
    return this.selectedPart;
  }

  render() {
    for (const button of this.buttons) {
      button.classList.toggle("selected", button.dataset.part === this.selectedPart);
    }

    const label = this.selectedPart ? PART_LABELS[this.selectedPart] : "none";
    this.selectionLabel.textContent = `Selected: ${label}`;
  }
}
