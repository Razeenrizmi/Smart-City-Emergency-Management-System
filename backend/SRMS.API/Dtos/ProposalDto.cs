namespace SRMS.API.Dtos;

public record ProposalDto(
    Guid Id,
    Guid JunctionId,
    string JunctionName,
    int ProposedGreenExtensionSec,
    bool? IsApprovedByOperator,
    DateTime CreatedAt);
