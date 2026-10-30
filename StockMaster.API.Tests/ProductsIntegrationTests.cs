
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockMaster.API.Controllers;
using StockMaster.API.Data;
using StockMaster.API.DTOs;
using StockMaster.API.Models;
using Xunit;

namespace StockMaster.API.Tests;

public class ProductsIntegrationTests
{
    private const string ExpectedDatabase =
        "StockMasterDB_IntegrationTests";

    private const string ExpectedServer =
        "DESKTOP-7SJ3Q5F";

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

            if (!string.Equals(
                    reader.GetString(0),
                    ExpectedDatabase,
                    StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(
                    reader.GetString(1),
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

    [Fact]
    public async Task CreateProduct_ValidData_ShouldCreateProduct()
    {
        var options = CreateOptions();

        string sku = "PRODUCT-TEST-" +
                     Guid.NewGuid().ToString("N");

        try
        {
            await using (var context = new AppDbContext(options))
            {
                await VerifyDatabaseAsync(context);

                var categoryId = await context.Categories
                    .AsNoTracking()
                    .Select(c => c.CategoryId)
                    .FirstAsync();

                var dto = new CreateProductDto
                {
                    Sku = sku,
                    Name = "Automated Product Test",
                    Description = "Temporary integration test",
                    CategoryId = categoryId,
                    SupplierId = null,
                    PurchasePrice = 10m,
                    SellingPrice = 20m,
                    Quantity = 50,
                    MinStockLevel = 5
                };

                var controller = new ProductsController(context);

                var result = await controller.CreateProduct(dto);

                var created = Assert.IsType<ObjectResult>(result);

                Assert.Equal(201, created.StatusCode);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                var product = await verifyContext.Products
                    .AsNoTracking()
                    .SingleAsync(p => p.Sku == sku);

                Assert.Equal(
                    "Automated Product Test",
                    product.Name);

                Assert.Equal(50, product.Quantity);
                Assert.Equal(10m, product.PurchasePrice);
                Assert.Equal(20m, product.SellingPrice);
                Assert.Equal(5, product.MinStockLevel);
            }
        }
        finally
        {
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await cleanupContext.Products
                .Where(p => p.Sku == sku)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task CreateProduct_DuplicateSku_ShouldReturnConflict()
    {
        var options = CreateOptions();

        await using var context = new AppDbContext(options);

        await VerifyDatabaseAsync(context);

        var originalProduct = await context.Products
            .AsNoTracking()
            .SingleAsync(p => p.Sku == "INTEGRATION-001");

        int originalCount = await context.Products.CountAsync();

        var dto = new CreateProductDto
        {
            Sku = "INTEGRATION-001",
            Name = "Duplicate SKU Test",
            Description = "Must not be created",
            CategoryId = originalProduct.CategoryId,
            SupplierId = null,
            PurchasePrice = 10m,
            SellingPrice = 20m,
            Quantity = 50,
            MinStockLevel = 5
        };

        var controller = new ProductsController(context);

        var result = await controller.CreateProduct(dto);

        var conflict = Assert.IsType<ConflictObjectResult>(result);

        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal("SKU already exists.", conflict.Value);

        await using var verifyContext = new AppDbContext(options);

        await VerifyDatabaseAsync(verifyContext);

        Assert.Equal(
            originalCount,
            await verifyContext.Products.CountAsync());

        var unchangedProduct = await verifyContext.Products
            .AsNoTracking()
            .SingleAsync(p => p.Sku == "INTEGRATION-001");

        Assert.Equal(
            originalProduct.ProductId,
            unchangedProduct.ProductId);

        Assert.Equal(
            originalProduct.Name,
            unchangedProduct.Name);

        Assert.Equal(
            originalProduct.Quantity,
            unchangedProduct.Quantity);
    }

    [Theory]
    [InlineData(-1, 20, 50, 5)]
    [InlineData(10, -1, 50, 5)]
    [InlineData(10, 20, -1, 5)]
    [InlineData(10, 20, 50, -1)]
    public async Task CreateProduct_InvalidData_ShouldReturnBadRequest(
        int purchasePrice,
        int sellingPrice,
        int quantity,
        int minStockLevel)
    {
        var options = CreateOptions();

        await using var context = new AppDbContext(options);

        await VerifyDatabaseAsync(context);

        int originalCount = await context.Products.CountAsync();

        var categoryId = await context.Categories
            .AsNoTracking()
            .Select(c => c.CategoryId)
            .FirstAsync();

        string sku = "INVALID-TEST-" +
                     Guid.NewGuid().ToString("N");

        var dto = new CreateProductDto
        {
            Sku = sku,
            Name = "Invalid Product Test",
            Description = "Must not be saved",
            CategoryId = categoryId,
            SupplierId = null,
            PurchasePrice = purchasePrice,
            SellingPrice = sellingPrice,
            Quantity = quantity,
            MinStockLevel = minStockLevel
        };

        var controller = new ProductsController(context);

        var result = await controller.CreateProduct(dto);

        var badRequest =
            Assert.IsType<BadRequestObjectResult>(result);

        Assert.Equal(400, badRequest.StatusCode);

        await using var verifyContext =
            new AppDbContext(options);

        await VerifyDatabaseAsync(verifyContext);

        Assert.Equal(
            originalCount,
            await verifyContext.Products.CountAsync());

        Assert.False(
            await verifyContext.Products
                .AnyAsync(p => p.Sku == sku));
    }

    [Fact]
    public async Task DeleteProduct_WithStockHistory_ShouldReturnConflict()
    {
        var options = CreateOptions();

        string sku = "DELETE-HISTORY-" +
                     Guid.NewGuid().ToString("N");

        int? productId = null;

        try
        {
            // Create temporary product and stock movement.
            await using (var setupContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(setupContext);

                var categoryId = await setupContext.Categories
                    .AsNoTracking()
                    .Select(c => c.CategoryId)
                    .FirstAsync();

                var user = await setupContext.AppUsers
                    .AsNoTracking()
                    .SingleAsync(u => u.UserId == 2);

                Assert.True(user.IsActive);

                await using var setupTransaction =
                    await setupContext.Database.BeginTransactionAsync();

                var product = new Product
                {
                    Sku = sku,
                    Name = "Protected Product Test",
                    Description = "Product with stock history",
                    CategoryId = categoryId,
                    SupplierId = null,
                    PurchasePrice = 10m,
                    SellingPrice = 20m,
                    Quantity = 15,
                    MinStockLevel = 5,
                    CreatedAt = DateTime.UtcNow
                };

                setupContext.Products.Add(product);
                await setupContext.SaveChangesAsync();

                productId = product.ProductId;

                var movement = new StockMovement
                {
                    ProductId = product.ProductId,
                    UserId = user.UserId,
                    MovementType = "IN",
                    Quantity = 5,
                    MovementDate = DateTime.UtcNow,
                    Notes = "Delete protection integration test"
                };

                setupContext.StockMovements.Add(movement);
                await setupContext.SaveChangesAsync();

                await setupTransaction.CommitAsync();
            }

            // Try to delete a product that has stock history.
            await using (var deleteContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(deleteContext);

                var controller =
                    new ProductsController(deleteContext);

                var result = await controller.DeleteProduct(
                    productId.Value);

                var conflict =
                    Assert.IsType<ConflictObjectResult>(result);

                Assert.Equal(409, conflict.StatusCode);

                Assert.Equal(
                    "Cannot delete product with sales or stock history.",
                    conflict.Value);
            }

            // Verify that neither record was deleted.
            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                Assert.True(
                    await verifyContext.Products
                        .AsNoTracking()
                        .AnyAsync(p =>
                            p.ProductId == productId.Value &&
                            p.Sku == sku));

                var movement = await verifyContext.StockMovements
                    .AsNoTracking()
                    .SingleAsync(m =>
                        m.ProductId == productId.Value);

                Assert.Equal("IN", movement.MovementType);
                Assert.Equal(5, movement.Quantity);
                Assert.Equal(
                    "Delete protection integration test",
                    movement.Notes);
            }
        }
        finally
        {
            // Remove only records created by this test.
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await using var cleanupTransaction =
                await cleanupContext.Database.BeginTransactionAsync();

            // Locate the uniquely identified temporary product.
            var temporaryProductId =
                await cleanupContext.Products
                    .AsNoTracking()
                    .Where(p => p.Sku == sku)
                    .Select(p => (int?)p.ProductId)
                    .SingleOrDefaultAsync();

            if (temporaryProductId.HasValue)
            {
                await cleanupContext.StockMovements
                    .Where(m =>
                        m.ProductId == temporaryProductId.Value)
                    .ExecuteDeleteAsync();

                await cleanupContext.Products
                    .Where(p =>
                        p.ProductId == temporaryProductId.Value &&
                        p.Sku == sku)
                    .ExecuteDeleteAsync();
            }

            await cleanupTransaction.CommitAsync();
        }
    }
}
