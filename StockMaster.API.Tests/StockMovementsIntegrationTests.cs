
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockMaster.API.Controllers;
using StockMaster.API.Data;
using StockMaster.API.DTOs;
using StockMaster.API.Models;
using Xunit;

namespace StockMaster.API.Tests;

public class StockMovementsIntegrationTests
{
    private const string ExpectedDatabase =
        "StockMasterDB_IntegrationTests";

    private const string ExpectedServer =
        "DESKTOP-7SJ3Q5F";

    private const int TestUserId = 2;

    private const string ConnectionString =
        "Server=DESKTOP-7SJ3Q5F;" +
        "Database=StockMasterDB_IntegrationTests;" +
        "Trusted_Connection=True;" +
        "TrustServerCertificate=True;";

    private static DbContextOptions<AppDbContext> CreateOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(ConnectionString)
            .Options;
    }

    private static async Task VerifyDatabaseAsync(
        AppDbContext context)
    {
        var connection = context.Database.GetDbConnection();

        if (!string.Equals(
                connection.Database,
                ExpectedDatabase,
                StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(
                connection.DataSource,
                ExpectedServer,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "SAFETY ERROR: Unexpected database or server.");
        }

        await context.Database.OpenConnectionAsync();

        try
        {
            await using var command = connection.CreateCommand();

            command.CommandText =
                "SELECT DB_NAME(), @@SERVERNAME";

            await using var reader =
                await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
            {
                throw new InvalidOperationException(
                    "Cannot verify database identity.");
            }

            var actualDatabase = reader.GetString(0);
            var actualServer = reader.GetString(1);

            if (!string.Equals(
                    actualDatabase,
                    ExpectedDatabase,
                    StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(
                    actualServer,
                    ExpectedServer,
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "SAFETY ERROR: Connected to unexpected database.");
            }
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }

    private static StockMovementsController CreateController(
        AppDbContext context)
    {
        var claims = new List<Claim>
        {
            new Claim(
                ClaimTypes.NameIdentifier,
                TestUserId.ToString()),

            new Claim(
                ClaimTypes.Role,
                "Employee")
        };

        var identity = new ClaimsIdentity(
            claims,
            "TestAuthentication");

        return new StockMovementsController(context)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(identity)
                }
            }
        };
    }

    private static async Task<int> CreateTemporaryProductAsync(
        DbContextOptions<AppDbContext> options)
    {
        await using var context = new AppDbContext(options);

        await VerifyDatabaseAsync(context);

        var user = await context.AppUsers
            .AsNoTracking()
            .SingleAsync(u => u.UserId == TestUserId);

        Assert.True(user.IsActive);
        Assert.Equal("Employee", user.Role);

        var categoryId = await context.Categories
            .AsNoTracking()
            .Select(c => c.CategoryId)
            .FirstAsync();

        var product = new Product
        {
            Sku = "MOV-TEST-" + Guid.NewGuid().ToString("N"),
            Name = "Temporary Movement Test Product",
            Description = "Automated integration test",
            CategoryId = categoryId,
            SupplierId = null,
            PurchasePrice = 10m,
            SellingPrice = 20m,
            Quantity = 100,
            MinStockLevel = 5,
            CreatedAt = DateTime.Now
        };

        context.Products.Add(product);

        await context.SaveChangesAsync();

        return product.ProductId;
    }

    private static async Task CleanupTemporaryProductAsync(
        DbContextOptions<AppDbContext> options,
        int productId)
    {
        await using var context = new AppDbContext(options);

        await VerifyDatabaseAsync(context);

        await using var transaction =
            await context.Database.BeginTransactionAsync();

        await context.StockMovements
            .Where(m => m.ProductId == productId)
            .ExecuteDeleteAsync();

        await context.Products
            .Where(p => p.ProductId == productId)
            .ExecuteDeleteAsync();

        await transaction.CommitAsync();
    }

    private static async Task TestMovementAsync(
        string movementType,
        int requestedQuantity,
        int expectedStatusCode,
        int expectedStock,
        int expectedMovementCount)
    {
        var options = CreateOptions();

        int? productId = null;

        try
        {
            productId = await CreateTemporaryProductAsync(options);

            await using (var movementContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(movementContext);

                var dto = new CreateStockMovementDto
                {
                    ProductId = productId.Value,
                    MovementType = movementType,
                    Quantity = requestedQuantity,
                    Notes = "Automated integration test"
                };

                var result = await CreateController(movementContext)
                    .CreateStockMovement(dto);

                var objectResult =
                    Assert.IsAssignableFrom<ObjectResult>(result);

                Assert.Equal(
                    expectedStatusCode,
                    objectResult.StatusCode);
            }

            await using var verifyContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(verifyContext);

            var product = await verifyContext.Products
                .AsNoTracking()
                .SingleAsync(p => p.ProductId == productId.Value);

            Assert.Equal(expectedStock, product.Quantity);

            var movements = await verifyContext.StockMovements
                .AsNoTracking()
                .Where(m => m.ProductId == productId.Value)
                .ToListAsync();

            Assert.Equal(expectedMovementCount, movements.Count);

            if (expectedMovementCount == 1)
            {
                var movement = Assert.Single(movements);

                Assert.Equal(TestUserId, movement.UserId);
                Assert.Equal(movementType, movement.MovementType);
                Assert.Equal(requestedQuantity, movement.Quantity);
                Assert.Equal(
                    "Automated integration test",
                    movement.Notes);
            }
        }
        finally
        {
            if (productId.HasValue)
            {
                await CleanupTemporaryProductAsync(
                    options,
                    productId.Value);
            }
        }
    }

    // TEST 1: IN increases stock and creates a movement.
    [Fact]
    public async Task CreateStockMovement_IN_ShouldIncreaseStockAndRecordMovement()
    {
        await TestMovementAsync(
            movementType: "IN",
            requestedQuantity: 5,
            expectedStatusCode: 201,
            expectedStock: 105,
            expectedMovementCount: 1);
    }

    // TEST 2: OUT deducts available stock.
    [Fact]
    public async Task CreateStockMovement_OUT_ShouldDeductStockAndRecordMovement()
    {
        await TestMovementAsync(
            movementType: "OUT",
            requestedQuantity: 5,
            expectedStatusCode: 201,
            expectedStock: 95,
            expectedMovementCount: 1);
    }

    // TEST 3: OUT must reject insufficient stock.
    [Fact]
    public async Task CreateStockMovement_OUT_InsufficientStock_ShouldNotChangeDatabase()
    {
        await TestMovementAsync(
            movementType: "OUT",
            requestedQuantity: 101,
            expectedStatusCode: 400,
            expectedStock: 100,
            expectedMovementCount: 0);
    }
}
