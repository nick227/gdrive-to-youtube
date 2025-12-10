const fs = require('fs');
const path = require('path');

const frontendOut = path.join(__dirname, '../../frontend/out');
const backendPublic = path.join(__dirname, '../public');

if (fs.existsSync(backendPublic)) {
  fs.rmSync(backendPublic, { recursive: true, force: true });
}

if (fs.existsSync(frontendOut)) {
  fs.cpSync(frontendOut, backendPublic, { recursive: true });
  console.log('Frontend copied to backend/public');
} else {
  console.warn('Frontend out directory not found, skipping copy');
}
