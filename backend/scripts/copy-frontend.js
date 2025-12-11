// scripts/copy-frontend.js
const fs = require("fs-extra");
const path = require("path");

const src = path.join(__dirname, "..", "frontend", "out");
const dest = path.join(__dirname, "..", "dist", "src", "public");

if (fs.existsSync(src)) {
  fs.ensureDirSync(dest);
  fs.copySync(src, dest, { overwrite: true });
  console.log("Frontend copied to dist/src/public");
} else {
  console.log("Frontend out directory not found, skipping copy");
}
