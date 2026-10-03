// Keeps the Signal Test Simulator's road names, last scan results, and
// signal-off toggles across a page refresh. Deliberately does NOT persist
// the uploaded video files themselves (Files/Blobs can't survive
// localStorage) or the live cycle state (activeStep/decision) — those need
// a real file in hand to mean anything, so a reload always starts a fresh
// cycle once footage is re-uploaded.
const STORAGE_KEY = 'srms.signalTestSimulator.v1';

export function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePersistedState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing, storage quota, etc. — this is a convenience, not
    // critical state, so fail silently rather than breaking the app.
  }
}
