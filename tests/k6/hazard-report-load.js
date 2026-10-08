// Load test: simulate many vehicles hitting potholes and posting hazard reports.
//
//   k6 run tests/k6/hazard-report-load.js
//   BASE_URL=https://host k6 run tests/k6/hazard-report-load.js
//
// Assertions (thresholds): p95 latency < 300ms, HTTP failure rate < 1%.

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5017';

export const options = {
  scenarios: {
    hazard_reports: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

// Colombo-ish bounding box so every report lands on a plausible road.
const randomInRange = (min, max) => min + Math.random() * (max - min);

export default function () {
  const payload = JSON.stringify({
    latitude: randomInRange(6.8, 7.0),
    longitude: randomInRange(79.8, 80.0),
    accelerometerZSpike: randomInRange(7.0, 19.0),
    hazardType: 'POTHOLE',
  });

  const response = http.post(`${BASE_URL}/api/hazards/report`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'report id returned': (r) => {
      try {
        return typeof r.json('id') === 'string';
      } catch (e) {
        return false;
      }
    },
  });
}
