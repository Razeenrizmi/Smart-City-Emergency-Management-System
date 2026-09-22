namespace SRMS.API.Support;

// Shared by the telemetry simulator (deciding whether to raise a proposal)
// and the intersections API (deciding what badge to show), so both always
// agree on what "congested" means.
public static class CongestionLevelCalculator
{
    public static string FromLaneDensityPercent(double laneDensityPercent)
    {
        if (laneDensityPercent >= 85) return "SEVERE";
        if (laneDensityPercent >= 65) return "HIGH";
        if (laneDensityPercent >= 35) return "MODERATE";
        return "LOW";
    }
}
