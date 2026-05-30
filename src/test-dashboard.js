import { readFileSync } from 'fs';
import { getApplicationProgress, resolveApplicationStatus } from './utils/applicationProgress.js';

function run() {
  const data = JSON.parse(readFileSync('apps.json', 'utf8'));
  const bookings = data.applications || [];
  
  const statusCounts = {
    pending: 0,
    doc_pending: 0,
    review: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    dash: 0,
  };

  const settingsForm = {};

  for (const booking of bookings) {
    const progress = getApplicationProgress(booking, settingsForm);
    const resolvedStatus = resolveApplicationStatus(booking, progress);
    if (Object.prototype.hasOwnProperty.call(statusCounts, resolvedStatus)) {
      statusCounts[resolvedStatus] += 1;
    }
  }

  console.log('Total bookings:', bookings.length);
  console.log('Status counts:', statusCounts);
}

run();
