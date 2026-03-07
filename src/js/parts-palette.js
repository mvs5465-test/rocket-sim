(function () {
  const K2D = window.K2D;
  const PART_DEFS = K2D.PART_DEFS;

  class PartsPalette {
    constructor(rootElement) {
      this.rootElement = rootElement;
      this.selectionLabel = rootElement.querySelector("#selection-label");
      this.statusLabel = rootElement.querySelector("#status-label");
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

    setEnabled(enabled) {
      for (const button of this.buttons) {
        button.disabled = !enabled;
      }
      if (!enabled) {
        this.clearSelection();
      }
    }

    clearSelection() {
      this.selectedPart = null;
      this.render();
    }

    setStatus(message) {
      this.statusLabel.textContent = message;
    }

    render() {
      for (const button of this.buttons) {
        button.classList.toggle("selected", button.dataset.part === this.selectedPart);
      }
      const label = this.selectedPart ? PART_DEFS[this.selectedPart].label : "none";
      this.selectionLabel.textContent = `Selected: ${label}`;
    }
  }

  K2D.PartsPalette = PartsPalette;
})();
