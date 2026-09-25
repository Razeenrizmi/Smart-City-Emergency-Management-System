const STEPS = [
  { id: 'emergency', label: 'Emergency' },
  { id: 'proposal', label: 'AI Proposal' },
  { id: 'validation', label: 'Validation' },
  { id: 'approval', label: 'Human Approval' },
  { id: 'greenwave', label: 'Green Wave' },
  { id: 'completion', label: 'Completion' },
  { id: 'restoration', label: 'Restoration' },
  { id: 'report', label: 'AI Report' },
];

function WorkflowStepper({ current }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="workflow-stepper" aria-label="Emergency Green Wave workflow">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={step.id} className={`workflow-step workflow-step-${state}`}>
            <span className="workflow-step-index">{index + 1}</span>
            <span className="workflow-step-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default WorkflowStepper;
