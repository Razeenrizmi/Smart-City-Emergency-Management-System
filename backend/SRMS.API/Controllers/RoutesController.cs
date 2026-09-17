using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Data;
using SRMS.API.DTOs;
using SRMS.API.Models;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/routes")]
public class RoutesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public RoutesController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET /api/routes
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RouteResponse>>> GetRoutes()
    {
        var routes = await _context.Routes
            .Select(r => new RouteResponse
            {
                RouteId = r.RouteId,
                RouteName = r.RouteName,
                StartLocation = r.StartLocation,
                Destination = r.Destination,
                DistanceKm = r.DistanceKm,
                EstimatedTimeMinutes = r.EstimatedTimeMinutes,
                TrafficLevel = r.TrafficLevel,
                Junctions = r.RouteJunctions
                    .OrderBy(rj => rj.SequenceNumber)
                    .Select(rj => new RouteJunctionResponse
                    {
                        JunctionId = rj.RoadJunction.JunctionId,
                        JunctionName = rj.RoadJunction.JunctionName,
                        Latitude = rj.RoadJunction.Latitude,
                        Longitude = rj.RoadJunction.Longitude,
                        CurrentSignalState = rj.RoadJunction.CurrentSignalState,
                        SequenceNumber = rj.SequenceNumber
                    })
                    .ToList()
            })
            .ToListAsync();

        return Ok(routes);
    }

    // GET /api/routes/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RouteResponse>> GetRoute(Guid id)
    {
        var route = await _context.Routes
            .Where(r => r.RouteId == id)
            .Select(r => new RouteResponse
            {
                RouteId = r.RouteId,
                RouteName = r.RouteName,
                StartLocation = r.StartLocation,
                Destination = r.Destination,
                DistanceKm = r.DistanceKm,
                EstimatedTimeMinutes = r.EstimatedTimeMinutes,
                TrafficLevel = r.TrafficLevel,
                Junctions = r.RouteJunctions
                    .OrderBy(rj => rj.SequenceNumber)
                    .Select(rj => new RouteJunctionResponse
                    {
                        JunctionId = rj.RoadJunction.JunctionId,
                        JunctionName = rj.RoadJunction.JunctionName,
                        Latitude = rj.RoadJunction.Latitude,
                        Longitude = rj.RoadJunction.Longitude,
                        CurrentSignalState = rj.RoadJunction.CurrentSignalState,
                        SequenceNumber = rj.SequenceNumber
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (route == null)
        {
            return NotFound();
        }

        return Ok(route);
    }
}
