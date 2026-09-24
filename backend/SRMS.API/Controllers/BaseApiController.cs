using Microsoft.AspNetCore.Mvc;

namespace SRMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class BaseApiController : ControllerBase { }