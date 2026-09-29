import { useState } from 'react';
import { api } from '../lib/api';

// Shows the 4 agents (Coordinator, Domain Analyst, Proposer, Validator)
// that produced a proposal, fetched on demand from
// GET /api/proposals/{id}/steps — evidence of each agent's "identifiable
// responsibility, defined input/output contract and visible participation"
// as required by the assignment's Agentic AI rubric.
export default function AgentStepsDetail({ proposalId }) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (steps) return;
    setLoading(true);
    try {
      const data = await api.getProposalSteps(proposalId);
      setSteps(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="agent-steps">
      <button type="button" className="agent-steps__toggle" onClick={handleToggle}>
        {open ? 'Hide agent details' : 'View agent details'}
      </button>

      {open && (
        <div className="agent-steps__panel">
          {loading && <p className="agent-steps__status">Loading agent steps…</p>}
          {error && <p className="agent-steps__status agent-steps__status--error">{error}</p>}
          {steps && steps.length === 0 && <p className="agent-steps__status">No steps recorded for this run.</p>}
          {steps && steps.length > 0 && (
            <ol className="agent-steps__list">
              {steps.map((s) => (
                <li key={`${s.agentName}-${s.stepIndex}`} className="agent-steps__item">
                  <div className="agent-steps__item-header">
                    <span className="agent-steps__agent-name">
                      {s.stepIndex + 1}. {s.agentName}
                    </span>
                    <span className={`agent-steps__validation agent-steps__validation--${s.validationResult.toLowerCase()}`}>
                      {s.validationResult}
                    </span>
                    <span className="agent-steps__duration">{s.durationMs}ms</span>
                  </div>
                  <details className="agent-steps__io">
                    <summary>Input / output</summary>
                    <pre>{formatJson(s.inputJson)}</pre>
                    <pre>{formatJson(s.outputJson)}</pre>
                    {s.toolCallsJson && <pre>{formatJson(s.toolCallsJson)}</pre>}
                  </details>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function formatJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
