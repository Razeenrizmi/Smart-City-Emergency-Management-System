namespace SRMS.API.Dtos;

public record SimulationRoadDto(string Name, int VehicleCount, int GreenSec = 0);

public record SaveSimulationRequest(string Name, List<SimulationRoadDto> Roads);

// GreenSec here IS used (unlike the initial create) — every update raises
// a fresh SignalTimingProposal carrying the simulator's computed plan.
public record UpdateSimulationRequest(List<SimulationRoadDto> Roads);
