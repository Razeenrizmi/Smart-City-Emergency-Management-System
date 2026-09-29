import { useState } from 'react';
import { MAX_ROADS, MIN_ROADS, generateRoadIds, roadLabel } from '../lib/directions';
import { api } from '../lib/api';
import './ManualSignalPlanForm.css';

const ROAD_COUNT_OPTIONS = Array.from({ length: MAX_ROADS - MIN_ROADS + 1 }, (_, i) => MIN_ROADS + i);

function defaultRoads(count) {
  return generateRoadIds(count).map((id) => ({ name: roadLabel(id), vehicleCount: '' }));
}

// Lets the operator type each road's vehicle count directly — no camera
// footage needed — and get back a real per-road AI signal-timing plan
// (more vehicles on a road -> more green seconds for it) from the same
// 4-agent workflow (SignalTimingAgentWorkflow) the rest of the app uses.
export default function ManualSignalPlanForm({ intersections }) {
  const [target, setTarget] = useState('new'); // 'new' or an intersection id
  const [newName, setNewName] = useState('');
  const [roadCount, setRoadCount] = useState(MIN_ROADS);
  const [roads, setRoads] = useState(() => defaultRoads(MIN_ROADS));
  // idle | saving | running | done | no-proposal | error
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  function handleRoadCountChange(count) {
    setRoadCount(count);
    setRoads(defaultRoads(count));
  }

  function updateRoad(index, field, value) {
    setRoads((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  const isValid =
    (target !== 'new' || newName.trim().length > 0) &&
    roads.every((r) => r.name.trim().length > 0 && r.vehicleCount !== '' && Number(r.vehicleCount) >= 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;

    setStatus('saving');
    setError(null);
    try {
      const roadsPayload = roads.map((r) => ({
        name: r.name.trim(),
        vehicleCount: Number(r.vehicleCount),
        greenSec: 0,
      }));

      let intersectionId = target;
      if (target === 'new') {
        const created = await api.saveSimulationAsIntersection(newName.trim(), roadsPayload);
        intersectionId = created.id;
      } else {
        await api.updateSimulationIntersection(target, roadsPayload);
      }

      setStatus('running');
      const result = await api.runAgentAnalysis(intersectionId);
      if (result.status === 'AWAITING_APPROVAL') {
        setStatus('done');
      } else {
        setStatus('no-proposal');
        // Surface the real reason (e.g. an agent-run failure) instead of
        // a generic message that hides what actually went wrong.
        setError(result.errorMessage ?? null);
      }

      if (target === 'new') {
        setTarget(intersectionId);
        setNewName('');
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  return (
    <section className="manual-plan">
      <h2>Manual signal timing planner</h2>
      <p className="manual-plan__hint">
        Type each road's vehicle count directly and get a real AI-computed green-light plan per road — no camera
        footage needed.
      </p>

      <form className="manual-plan__form" onSubmit={handleSubmit}>
        <div className="manual-plan__row">
          <label className="manual-plan__field">
            Junction
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="new">New junction…</option>
              {intersections.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>

          {target === 'new' && (
            <label className="manual-plan__field manual-plan__field--grow">
              Name
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Main St & 2nd Ave"
              />
            </label>
          )}

          <label className="manual-plan__field">
            Roads
            <select value={roadCount} onChange={(e) => handleRoadCountChange(Number(e.target.value))}>
              {ROAD_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="manual-plan__roads">
          {roads.map((road, i) => (
            <div key={i} className="manual-plan__road">
              <input
                type="text"
                className="manual-plan__road-name"
                value={road.name}
                onChange={(e) => updateRoad(i, 'name', e.target.value)}
                placeholder="Road name"
              />
              <input
                type="number"
                min="0"
                className="manual-plan__road-count"
                value={road.vehicleCount}
                onChange={(e) => updateRoad(i, 'vehicleCount', e.target.value)}
                placeholder="Vehicles"
              />
            </div>
          ))}
        </div>

        <div className="manual-plan__actions">
          <button
            type="submit"
            className="manual-plan__submit"
            disabled={!isValid || status === 'saving' || status === 'running'}
          >
            {status === 'saving' && 'Saving…'}
            {status === 'running' && 'Running agent…'}
            {(status === 'idle' || status === 'done' || status === 'no-proposal' || status === 'error') &&
              'Get AI signal timing plan'}
          </button>
          {status === 'done' && <span className="manual-plan__status manual-plan__status--success">Proposal ready below.</span>}
          {status === 'no-proposal' && (
            <span className="manual-plan__status manual-plan__status--error">
              Agent ran but didn't produce a proposal{error ? `: ${error}` : '.'}
            </span>
          )}
          {status === 'error' && <span className="manual-plan__status manual-plan__status--error">{error}</span>}
        </div>
      </form>
    </section>
  );
}
