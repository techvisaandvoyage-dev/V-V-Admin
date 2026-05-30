const fs = require('fs');
const filePath = 'c:/Users/yashr/OneDrive/Desktop/Projects/VB/admin/src/pages/Dashboard.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
for (let i = 0; i < 80; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
