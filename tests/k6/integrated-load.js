// Mixed-read/write load across the integrated SRMS API.
//
//   k6 run tests/k6/integrated-load.js
//   BASE_URL=http://localhost:5017 k6 run tests/k6/integrated-load.js
//
// Complements hazard-report-load.js (write-heavy pothole reporting).
// Thresholds: p95 < 500 ms (mixed endpoints), HTTP failure rate < 1%.

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5017';

export const options = {
  scenarios: {
    mixed_traffic: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const randomInRange = (min, max) => min + Math.random() * (max - min);

export default function () {
  const roll = Math.random();
  let response;

  if (roll < 0.45) {
    response = http.post(
      `${BASE_URL}/api/hazards/report`,
      JSON.stringify({
        latitude: randomInRange(6.8, 7.0),
        longitude: randomInRange(79.8, 80.0),
        accelerometerZSpike: randomInRange(7.0, 19.0),
        hazardType: 'POTHOLE',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    check(response, { 'hazard report 200': (r) => r.status === 200 });
  } else if (roll < 0.65) {
    response = http.get(`${BASE_URL}/api/hazards/all`);
    check(response, { 'hazards/all 200': (r) => r.status === 200 });
  } else if (roll < 0.8) {
    response = http.get(`${BASE_URL}/api/routes`);
    check(response, { 'routes 200': (r) => r.status === 200 });
  } else if (roll < 0.9) {
    response = http.get(`${BASE_URL}/api/Intersections`);
    check(response, { 'intersections 200': (r) => r.status === 200 });
  } else {
    response = http.get(`${BASE_URL}/health`);
    check(response, { 'health 200': (r) => r.status === 200 });
  }
}
