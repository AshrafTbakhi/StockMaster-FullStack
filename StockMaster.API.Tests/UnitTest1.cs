
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
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

public class UnitTest1
{
    private const string TestDatabase =
        "StockMasterDB_IntegrationTests";

    private const string TestServer =
        "DESKTOP-7SJ3Q5F";

    private const int TestUserId = 2;

    private const string TestConnection =
        "Server=DESKTOP-7SJ3Q5F;" +
        "Database=StockMasterDB_IntegrationTests;" +
        "Trusted_Connection=True;" +
        "TrustServerCertificate=True;";

    private static DbContextOptions<AppDbContext> CreateOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(TestConnection)
            .Options;
    }

    private static async Task VerifyTestDatabase(
        AppDbContext context)
    {
        var connection = context.Database.GetDbConnection();

        Assert.Equal(TestDatabase, connection.Database);

        Assert.True(
            string.Equals(
                TestServer,
                connection.DataSource,
                StringComparison.OrdinalIgnoreCase));

        Assert.True(await context.Database.CanConnectAsync());

        await context.Database.OpenConnectionAsync();

        try
        {
            await using var command =
                context.Database.GetDbConnection().CreateCommand();

            command.CommandText = "SELECT DB_NAME()";

            var actualDatabase =
                (await command.ExecuteScalarAsync())?.ToString();

            Assert.Equal(TestDatabase, actualDatabase);
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }

    private static SalesController CreateController(
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

        return new SalesController(context)
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

    [Fact]
    public async Task CreateSale_InvalidQuantity_ShouldNotChangeDatabase()
    {
        var options = CreateOptions();

        await using var context = new AppDbContext(options);
        await VerifyTestDatabase(context);

        var originalSales = await context.Sales.CountAsync();
        var originalItems = await context.SaleItems.CountAsync();
        var originalMovements =
            await context.StockMovements.CountAsync();

        var dto = new CreateSaleDto
        {
            Items = new List<CreateSaleItemDto>
            {
                new CreateSaleItemDto
                {
                    ProductId = 1,
                    Quantity = 0
                }
            }
        };

        var result = await CreateController(context)
            .CreateSale(dto);

        var badRequest =
            Assert.IsType<BadRequestObjectResult>(result);

        Assert.Equal(400, badRequest.StatusCode);

        await using var verifyContext =
            new AppDbContext(options);

        await VerifyTestDatabase(verifyContext);

        Assert.Equal(
            originalSales,
            await verifyContext.Sales.CountAsync());

        Assert.Equal(
            originalItems,
            await verifyContext.SaleItems.CountAsync());

        Assert.Equal(
            originalMovements,
            await verifyContext.StockMovements.CountAsync());
    }

    [Fact]
    public async Task CreateSale_ValidStock_ShouldCreateSaleAndDeductStock()
    {
        var options = CreateOptions();

        int? testProductId = null;
        int? createdSaleId = null;
        int? createdMovementId = null;

        try
        {
            await using (var setupContext =
                new AppDbContext(options))
            {
                await VerifyTestDatabase(setupContext);

                var user = await setupContext.AppUsers
                    .AsNoTracking()
                    .SingleAsync(u => u.UserId == TestUserId);

                Assert.True(user.IsActive);
                Assert.Equal("Employee", user.Role);

                var categoryId = await setupContext.Categories
                    .AsNoTracking()
                    .Select(c => c.CategoryId)
                    .FirstAsync();

                var product = new Product
                {
                    Sku = "TEST-" + Guid.NewGuid().ToString("N"),
                    Name = "Automated Test Product",
                    Description = "Created by automated integration test",
                    CategoryId = categoryId,
                    SupplierId = null,
                    PurchasePrice = 10m,
                    SellingPrice = 20m,
                    Quantity = 100,
                    MinStockLevel = 5,
                    CreatedAt = DateTime.Now
                };

                setupContext.Products.Add(product);
                await setupContext.SaveChangesAsync();

                testProductId = product.ProductId;
            }

            const int saleQuantity = 3;

            await using (var saleContext =
                new AppDbContext(options))
            {
                await VerifyTestDatabase(saleContext);

                var dto = new CreateSaleDto
                {
                    Items = new List<CreateSaleItemDto>
                    {
                        new CreateSaleItemDto
                        {
                            ProductId = testProductId.Value,
                            Quantity = saleQuantity
                        }
                    }
                };

                var result = await CreateController(saleContext)
                    .CreateSale(dto);

                var created =
                    Assert.IsType<ObjectResult>(result);

                Assert.Equal(201, created.StatusCode);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyTestDatabase(verifyContext);

                var product = await verifyContext.Products
                    .AsNoTracking()
                    .SingleAsync(p =>
                        p.ProductId == testProductId.Value);

                Assert.Equal(97, product.Quantity);

                var saleItem = await verifyContext.SaleItems
                    .AsNoTracking()
                    .SingleAsync(i =>
                        i.ProductId == testProductId.Value);

                createdSaleId = saleItem.SaleId;

                Assert.Equal(saleQuantity, saleItem.Quantity);
                Assert.Equal(20m, saleItem.UnitPrice);
                Assert.Equal(60m, saleItem.LineTotal);

                var sale = await verifyContext.Sales
                    .AsNoTracking()
                    .SingleAsync(s =>
                        s.SaleId == createdSaleId.Value);

                Assert.Equal(TestUserId, sale.UserId);
                Assert.Equal(60m, sale.TotalAmount);

                var movement = await verifyContext.StockMovements
                    .AsNoTracking()
                    .SingleAsync(m =>
                        m.ProductId == testProductId.Value);

                createdMovementId = movement.MovementId;

                Assert.Equal(TestUserId, movement.UserId);
                Assert.Equal("OUT", movement.MovementType);
                Assert.Equal(saleQuantity, movement.Quantity);
            }
        }
        finally
        {
            if (testProductId.HasValue)
            {
                await using var cleanupContext =
                    new AppDbContext(options);

                await VerifyTestDatabase(cleanupContext);

                await using var transaction =
                    await cleanupContext.Database.BeginTransactionAsync(
                        IsolationLevel.Serializable);

                // Recover only the sale linked to our unique product.
                var saleIds = await cleanupContext.SaleItems
                    .AsNoTracking()
                    .Where(i => i.ProductId == testProductId.Value)
                    .Select(i => i.SaleId)
                    .Distinct()
                    .ToListAsync();

                if (createdSaleId.HasValue &&
                    !saleIds.Contains(createdSaleId.Value))
                {
                    throw new InvalidOperationException(
                        "Cleanup safety check failed: sale mismatch.");
                }

                // Never delete an invoice containing other products.
                foreach (var saleId in saleIds)
                {
                    bool hasOtherProducts =
                        await cleanupContext.SaleItems
                            .AnyAsync(i =>
                                i.SaleId == saleId &&
                                i.ProductId != testProductId.Value);

                    if (hasOtherProducts)
                    {
                        throw new InvalidOperationException(
                            "Cleanup stopped: invoice contains other products.");
                    }
                }

                await cleanupContext.SaleItems
                    .Where(i =>
                        i.ProductId == testProductId.Value &&
                        saleIds.Contains(i.SaleId))
                    .ExecuteDeleteAsync();

                // Movements belong to our unique test product.
                await cleanupContext.StockMovements
                    .Where(m =>
                        m.ProductId == testProductId.Value)
                    .ExecuteDeleteAsync();

                if (saleIds.Count > 0)
                {
                    await cleanupContext.Sales
                        .Where(s => saleIds.Contains(s.SaleId))
                        .ExecuteDeleteAsync();
                }

                await cleanupContext.Products
                    .Where(p =>
                        p.ProductId == testProductId.Value)
                    .ExecuteDeleteAsync();

                await transaction.CommitAsync();
            }
        }
    }
}
