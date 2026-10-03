class AiWorkflow {
  final String workflowStatus;
  final String proposalStatus;
  final String approvalStatus;
  final bool isValid;
  final bool handoffReady;
  final bool signalExecutionPerformed;
  final String? errorSummary;

  AiWorkflow({
    required this.workflowStatus,
    required this.proposalStatus,
    required this.approvalStatus,
    required this.isValid,
    required this.handoffReady,
    required this.signalExecutionPerformed,
    this.errorSummary,
  });

  factory AiWorkflow.fromJson(Map<String, dynamic> json) {
    return AiWorkflow(
      workflowStatus: json['workflowStatus'] as String? ?? '',
      proposalStatus: json['proposalStatus'] as String? ?? '',
      approvalStatus: json['approvalStatus'] as String? ?? '',
      isValid: json['isValid'] as bool? ?? false,
      handoffReady: json['handoffReady'] as bool? ?? false,
      signalExecutionPerformed: json['signalExecutionPerformed'] as bool? ?? false,
      errorSummary: json['errorSummary'] as String?,
    );
  }
}
