const fs = require('fs');
const filePath = 'c:/Users/yashr/OneDrive/Desktop/Projects/VB/admin/src/pages/Dashboard.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('saveSettingsSection')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
