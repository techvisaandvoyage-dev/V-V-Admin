import fetch from 'node-fetch';
import fs from 'fs';

async function run() {
  const r = await fetch('http://localhost:5000/api/admin/applications');
  const d = await r.json();
  fs.writeFileSync('apps.json', JSON.stringify(d, null, 2));
  console.log('Saved to apps.json');
}
run();
