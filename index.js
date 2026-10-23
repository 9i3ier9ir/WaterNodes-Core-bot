const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const distEntry = path.join(__dirname, "dist", "index.js");

if (!fs.existsSync(distEntry)) {
  try {
    execSync("npx tsc", { cwd: __dirname, stdio: "inherit" });
  } catch (error) {
    console.error("Failed to build the Discord bot before startup.");
    process.exit(1);
  }
}

if (!fs.existsSync(distEntry)) {
  console.error("Missing compiled entry file at dist/index.js after build attempt.");
  process.exit(1);
}

require(distEntry);
