using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRMS.API.Controllers;
using SRMS.API.Data;
using SRMS.API.Models;
using Xunit;

namespace SRMS.Tests;

public class CctvControllerTests
{
    private AppDbContext GetInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetNodes_ReturnsSeededNodes()
    {
        // Arrange
        using var context = GetInMemoryDbContext("CctvTest_GetNodes");
        context.CctvNodes.AddRange(
            new CctvNode { Id = 1, NodeId = 1, CameraName = "Main St CCTV", Location = "Main St", CameraType = "LAPTOP_WEBCAM", Status = "OFFLINE", StreamSource = "LOCAL_WEBCAM", CreatedAt = "2026-01-01" },
            new CctvNode { Id = 2, NodeId = 2, CameraName = "University Gate CCTV", Location = "Gate", CameraType = "MOBILE_CAMERA", Status = "OFFLINE", StreamSource = "PHONE_CAMERA", CreatedAt = "2026-01-01" }
        );
        await context.SaveChangesAsync();

        var controller = new CctvController(context);

        // Act
        var result = await controller.GetNodes();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<List<CctvNode>>>(okResult.Value);
        Assert.True(response.Success);
        Assert.NotNull(response.Data);
        Assert.Equal(2, response.Data.Count);
    }

    [Fact]
    public async Task UpdateNodeStatus_ValidStatus_UpdatesNodeStatus()
    {
        // Arrange
        using var context = GetInMemoryDbContext("CctvTest_UpdateStatus");
        context.CctvNodes.Add(new CctvNode
        {
            Id = 1, NodeId = 1, CameraName = "Main St CCTV", Location = "Main St", CameraType = "LAPTOP_WEBCAM", Status = "OFFLINE", StreamSource = "LOCAL_WEBCAM", CreatedAt = "2026-01-01"
        });
        await context.SaveChangesAsync();

        var controller = new CctvController(context);

        // Act
        var result = await controller.UpdateNodeStatus(1, new NodeStatusRequest { Status = "ONLINE" });

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<CctvNode>>(okResult.Value);
        Assert.True(response.Success);
        Assert.NotNull(response.Data);
        Assert.Equal("ONLINE", response.Data.Status);
    }

    [Fact]
    public async Task UpdateNodeStatus_InvalidStatus_ReturnsBadRequest()
    {
        // Arrange
        using var context = GetInMemoryDbContext("CctvTest_InvalidStatus");
        context.CctvNodes.Add(new CctvNode
        {
            Id = 1, NodeId = 1, CameraName = "Main St CCTV", Location = "Main St", CameraType = "LAPTOP_WEBCAM", Status = "OFFLINE", StreamSource = "LOCAL_WEBCAM", CreatedAt = "2026-01-01"
        });
        await context.SaveChangesAsync();

        var controller = new CctvController(context);

        // Act
        var result = await controller.UpdateNodeStatus(1, new NodeStatusRequest { Status = "INVALID_STATUS" });

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<CctvNode>>(badRequestResult.Value);
        Assert.False(response.Success);
    }
}
