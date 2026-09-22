const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5017';

// Thin wrapper around fetch for the real backend API — unwraps the
// ApiResponse<T> { success, message, data } shape every SRMS.API endpoint
// returns, and throws with the server's own message on failure so callers
// can show it directly.
async function request(path, options) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.message || `Request failed (${res.status})`);
  }

  return body.data;
}

export const api = {
  getIntersections: () => request('/api/intersections'),
  getPendingProposals: () => request('/api/proposals?status=pending'),
  approveProposal: (id) => request(`/api/proposals/${id}/approve`, { method: 'POST' }),
  rejectProposal: (id) => request(`/api/proposals/${id}/reject`, { method: 'POST' }),
  deleteIntersection: (id) => request(`/api/intersections/${id}`, { method: 'DELETE' }),
  saveSimulationAsIntersection: (name, roads) =>
    request('/api/intersections/from-simulation', {
      method: 'POST',
      body: JSON.stringify({ name, roads }),
    }),
  updateSimulationIntersection: (id, roads) =>
    request(`/api/intersections/${id}/update-from-simulation`, {
      method: 'POST',
      body: JSON.stringify({ roads }),
    }),
};
