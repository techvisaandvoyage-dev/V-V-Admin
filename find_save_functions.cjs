const fs = require('fs');
const filePath = 'c:/Users/yashr/OneDrive/Desktop/Projects/VB/admin/src/pages/Dashboard.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
console.log('Total lines:', lines.length);

console.log('\n--- Lines containing activeCountryIds ---');
lines.forEach((line, idx) => {
  if (line.includes('activeCountryIds')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
