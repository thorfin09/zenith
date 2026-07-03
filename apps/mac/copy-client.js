const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../client/dist');
const destDir = path.join(__dirname, 'dist-client');

try {
  if (fs.existsSync(srcDir)) {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    fs.cpSync(srcDir, destDir, { recursive: true });
    console.log('Client build files successfully copied to mac dist-client.');
  } else {
    console.error('Client build not found at: ' + srcDir + '. Make sure to run the client build task first.');
    process.exit(1);
  }
} catch (err) {
  console.error('Failed to copy client build files:', err);
  process.exit(1);
}
