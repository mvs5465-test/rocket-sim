(function () {
  const K2D = window.K2D || (window.K2D = {});

  function computeFlightCamera(baseCamera, vessel, viewport) {
    const x = vessel.x - viewport.width * 0.52;
    const desiredY = vessel.y - viewport.height * 0.5;
    const y = Math.min(baseCamera.y, desiredY);
    return { x, y };
  }

  K2D.CameraModel = {
    computeFlightCamera
  };
})();
