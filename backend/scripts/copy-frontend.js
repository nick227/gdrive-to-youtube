const fs = require("fs-extra");
const path = require("path");

const src = path.join(__dirname, "..", "..", "frontend", "out");
const dest = path.join(__dirname, "..", "dist", "public");

console.log("Copying frontend:");
console.log("  FROM:", src);
console.log("  TO:  ", dest);

if (fs.existsSync(src)) {
  fs.ensureDirSync(dest);
  fs.copySync(src, dest, { overwrite: true });
  console.log("Frontend copied to dist/public");
} else {
  console.log("Frontend 'out' folder not found — skipping");
}
