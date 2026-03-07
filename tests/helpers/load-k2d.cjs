const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadK2D(scriptPaths) {
  const context = {
    window: { K2D: {} },
    console,
    Math
  };
  context.global = context;

  for (const relPath of scriptPaths) {
    const fullPath = path.resolve(__dirname, "..", "..", relPath);
    const code = fs.readFileSync(fullPath, "utf8");
    vm.runInNewContext(code, context, { filename: fullPath });
  }

  return context.window.K2D;
}

module.exports = { loadK2D };
