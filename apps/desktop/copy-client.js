const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../client/dist');
const destDir = path.join(__dirname, 'dist-client');

try {
  if (fs.existsSync(srcDir)) {
    // Remove existing destination directory if it exists
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    // Copy client build files recursively (fs.cpSync is standard since Node 16.7.0)
    fs.cpSync(srcDir, destDir, { recursive: true });
    console.log('Client build files successfully copied to dist-client.');
  } else {
    console.error('Client build not found at: ' + srcDir + '. Make sure to run the client build task first.');
    process.exit(1);
  }
} catch (err) {
  console.error('Failed to copy client build files:', err);
  process.exit(1);
}
