const fs = require('fs');
const filePath = 'c:/Users/yashr/OneDrive/Desktop/Projects/VB/admin/src/pages/Dashboard.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('const Input') || line.includes('function Input')) {
    console.log(`Found on line ${idx + 1}: ${line.trim()}`);
    // Print 15 lines
    for (let i = 0; i < 15; i++) {
      console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
    }
  }
});
