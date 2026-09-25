import { useCallback, useEffect, useMemo, useState } from 'react';
import StatusBadge from './StatusBadge';
import WorkflowStepper from './WorkflowStepper';
import {
  activateGreenWave,
  approveAiWorkflow,
  completeEmergency,
  getAiReport,
  getAiWorkflow,
  proposeSignals,
  rejectAiWorkflow,
} from '../../services/emergencyService';

function workflowStep(emergency, workflow, report) {
  if (emergency.status === 'COMPLETED' || report?.greenWave?.status === 'RESTORED') return 'report';
  if (workflow?.signalExecutionPerformed || report?.greenWave?.status === 'GREEN_WAVE_ACTIVE') return 'completion';
  if (workflow?.approvalStatus === 'APPROVED') return 'greenwave';
  if (workflow?.isValid || workflow?.proposalStatus) return 'approval';
  return 'proposal';
}

function dateText(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function ActionList({ actions = [], title = 'Proposed Junction Actions' }) {
  return (
    <section className="workflow-card">
      <h3>{title}</h3>
      {actions.length === 0 ? <p className="workflow-muted">No junction actions were returned.</p> : (
        <div className="workflow-actions">
          {actions.map((action, index) => (
            <div className="workflow-action" key={action.junctionId || index}>
              <span className="workflow-action-order">{action.sequenceOrder || index + 1}</span>
              <div className="workflow-action-details">
                <strong>{action.junctionName || action.junctionId}</strong>
                <span>{action.action || 'No action specified'}</span>
              </div>
              <div className="workflow-action-target">
                <StatusBadge value={action.targetSignalState || action.restoredSignalState} />
                <small>{action.holdDurationSeconds ? `${action.holdDurationSeconds}s hold` : ''}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AiWorkflowPanel({ emergency }) {
  const sessionId = emergency.sessionId;
  const [workflow, setWorkflow] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [operatorId, setOperatorId] = useState('');
  const [notes, setNotes] = useState('');

  const loadWorkflow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getAiWorkflow(sessionId);
      setWorkflow(current);
      if (current || emergency.status === 'COMPLETED') {
        setReport(await getAiReport(sessionId));
      } else {
        setReport(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [emergency.status, sessionId]);

  useEffect(() => {
    const refreshTimer = setTimeout(() => { loadWorkflow(); }, 0);
    return () => clearTimeout(refreshTimer);
  }, [loadWorkflow]);

  const currentStep = useMemo(
    () => workflowStep(emergency, workflow, report),
    [emergency, report, workflow]
  );

  const runAction = async (action) => {
    setWorking(true);
    setError(null);
    try {
      await action();
      await loadWorkflow();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const decide = (approve) => runAction(async () => {
    const payload = { operatorId: operatorId.trim() || null, notes: notes.trim() || null };
    if (approve) await approveAiWorkflow(sessionId, payload);
    else await rejectAiWorkflow(sessionId, payload);
  });

  const activate = () => runAction(async () => {
    await activateGreenWave(sessionId);
  });

  const complete = () => runAction(async () => {
    await completeEmergency(sessionId);
  });

  return (
    <section className="workflow-section">
      <div className="workflow-heading">
        <div><p className="eyebrow">AI-assisted traffic control</p><h2>Emergency Green Wave Workflow</h2></div>
        <button className="secondary-button" type="button" onClick={loadWorkflow} disabled={loading || working}>
          {loading ? 'Loading...' : 'Refresh workflow'}
        </button>
      </div>
      <WorkflowStepper current={currentStep} />
      {error && <div className="workflow-error" role="alert">{error}</div>}
      {loading ? <div className="loading-state">Loading AI workflow status...</div> : (
        <>
          {!workflow && emergency.status === 'ACTIVE' && (
            <section className="workflow-card workflow-start">
              <h3>Generate AI Signal Proposal</h3>
              <p>Request and persist a route-aware signal proposal through the ASP.NET API. No signals change at this stage.</p>
              <button className="primary-button" type="button" onClick={() => runAction(async () => { await proposeSignals(sessionId); })} disabled={working || emergency.status !== 'ACTIVE'}>
                {working ? 'Generating proposal...' : 'Generate AI Signal Proposal'}
              </button>
              {emergency.status !== 'ACTIVE' && <p className="workflow-muted">Only active emergency sessions can start a proposal.</p>}
            </section>
          )}
          {workflow && (
            <>
              <section className="workflow-card workflow-status-card">
                <div className="workflow-status-header">
                  <div><h3>AI Workflow Status</h3><p className="workflow-muted">{workflow.objective || 'Route-aware signal preemption proposal'}</p></div>
                  <StatusBadge value={workflow.workflowStatus || workflow.proposalStatus} />
                </div>
                <div className="workflow-summary-grid">
                  <div><span>Proposal</span><strong><StatusBadge value={workflow.proposalStatus} /></strong></div>
                  <div><span>Validation</span><strong>{workflow.isValid ? 'Valid' : 'Needs review'}</strong></div>
                  <div><span>Handoff</span><strong>{workflow.handoffReady ? 'Ready' : 'Not ready'}</strong></div>
                  <div><span>Updated</span><strong>{dateText(workflow.updatedAt)}</strong></div>
                </div>
                {workflow.validationNotes?.length > 0 && <ul className="workflow-notes">{workflow.validationNotes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
                {workflow.errorSummary && <p className="workflow-error">{workflow.errorSummary}</p>}
              </section>
              <ActionList actions={workflow.proposedActions} />
              {emergency.status === 'ACTIVE' && workflow.approvalStatus !== 'APPROVED' && workflow.proposalStatus !== 'REJECTED' && !workflow.signalExecutionPerformed && (
                <section className="workflow-card">
                  <h3>Pending Human Approval</h3>
                  <p>Review the validation result and proposed junction actions before approving execution.</p>
                  <div className="workflow-form-grid">
                    <label>Operator ID<input value={operatorId} onChange={(event) => setOperatorId(event.target.value)} placeholder="e.g. control-room-01" /></label>
                    <label>Decision notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="3" placeholder="Optional operator notes" /></label>
                  </div>
                  <div className="workflow-button-row">
                    <button className="primary-button" type="button" onClick={() => decide(true)} disabled={working || !workflow.isValid}>{working ? 'Saving decision...' : 'Approve proposal'}</button>
                    <button className="danger-button" type="button" onClick={() => decide(false)} disabled={working}>Reject proposal</button>
                  </div>
                  {!workflow.isValid && <p className="workflow-muted">Approval is disabled because validation did not pass.</p>}
                </section>
              )}
              {emergency.status === 'ACTIVE' &&
                workflow.approvalStatus === 'APPROVED' &&
                !workflow.signalExecutionPerformed && (
                <section className="workflow-card workflow-success">
                  <h3>Approval recorded</h3>
                  <p>Approved by {workflow.approvedBy || operatorId || 'operator'} on {dateText(workflow.approvedAt)}.</p>
                  <button className="primary-button" type="button" onClick={activate} disabled={working || emergency.status !== 'ACTIVE'}>{working ? 'Activating Green Wave...' : 'Activate Green Wave'}</button>
                </section>
              )}
              {emergency.status === 'ACTIVE' &&
                workflow.signalExecutionPerformed &&
                report?.greenWave?.status !== 'RESTORED' && (
                <section className="workflow-card workflow-success">
                  <h3>Green Wave active</h3>
                  <p>Signal execution is complete. Complete the emergency when the response vehicle has cleared the route.</p>
                  <button className="primary-button" type="button" onClick={complete} disabled={working}>{working ? 'Restoring signals...' : 'Complete emergency and restore signals'}</button>
                </section>
              )}
            </>
          )}
          {report && (
            <section className="workflow-card workflow-report">
              <h3>AI Decision &amp; Execution Report</h3>
              <div className="workflow-summary-grid">
                <div><span>Emergency</span><strong><StatusBadge value={report.emergency?.status} /></strong></div>
                <div><span>Green Wave</span><strong><StatusBadge value={report.greenWave?.status} /></strong></div>
                <div><span>Activated</span><strong>{dateText(report.greenWave?.activatedAt)}</strong></div>
                <div><span>Restored</span><strong>{dateText(report.greenWave?.restoredAt)}</strong></div>
              </div>
              {report.workflow && (
                <div className="workflow-summary-grid">
                  <div><span>Approval</span><strong><StatusBadge value={report.workflow.approvalStatus} /></strong></div>
                  <div><span>Approved by</span><strong>{report.workflow.approvedBy || '—'}</strong></div>
                  <div><span>Approval time</span><strong>{dateText(report.workflow.approvedAt)}</strong></div>
                  <div><span>Approval notes</span><strong>{report.workflow.approvalNotes || '—'}</strong></div>
                </div>
              )}
              {report.workflow?.validationNotes?.length > 0 && (
                <ul className="workflow-notes">
                  {report.workflow.validationNotes.map((note, index) => <li key={index}>{note}</li>)}
                </ul>
              )}
              {report.workflow?.proposedActions?.length > 0 && <ActionList title="Persisted Proposed Junction Actions" actions={report.workflow.proposedActions} />}
              {emergency.status !== 'CANCELLED' && report.greenWave?.restoredJunctions?.length > 0 && <ActionList title="Restoration Result" actions={report.greenWave.restoredJunctions} />}
              {report.errorSummary && <p className="workflow-error">{report.errorSummary}</p>}
            </section>
          )}
        </>
      )}
    </section>
  );
}

export default AiWorkflowPanel;
