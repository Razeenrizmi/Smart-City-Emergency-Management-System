using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SRMS.API.Controllers;
using SRMS.API.Data;
using SRMS.API.Models;
using Xunit;

namespace SRMS.Tests;

public class CrimeVehicleControllerTests
{
    private AppDbContext GetInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task ScanImage_NullImage_ReturnsBadRequest()
    {
        // Arrange
        using var context = GetInMemoryDbContext("CrimeVehicleTest_NullImage");
        var httpClientFactory = new MockHttpClientFactory();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var controller = new CrimeVehicleController(context, httpClientFactory, configuration);

        // Act
        var result = await controller.ScanImage(null!);

        // Assert
        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<ScanResultResponse>>(badRequestResult.Value);
        Assert.False(response.Success);
        Assert.Equal("No image uploaded", response.Message);
    }

    private class MockHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            return new HttpClient();
        }
    }
}
