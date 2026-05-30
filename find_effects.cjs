const fs = require('fs');
const filePath = 'c:/Users/yashr/OneDrive/Desktop/Projects/VB/admin/src/pages/Dashboard.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('useEffect(')) {
    console.log(`\nFound useEffect on line ${idx + 1}: ${line.trim()}`);
    // Print 10 lines of the body
    for (let i = 0; i < 15; i++) {
      console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
    }
  }
});
