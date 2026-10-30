
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

public class SuppliersIntegrationTests
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
    public async Task CreateSupplier_ValidData_ShouldCreateSupplier()
    {
        var options = CreateOptions();

        string name = "SUPPLIER-TEST-" +
                      Guid.NewGuid().ToString("N");

        try
        {
            await using (var context = new AppDbContext(options))
            {
                await VerifyDatabaseAsync(context);

                var dto = new CreateSupplierDto
                {
                    Name = name,
                    Phone = "0599000000",
                    Email = "supplier-test@example.invalid",
                    Address = "Test Address"
                };

                var controller =
                    new SuppliersController(context);

                var result =
                    await controller.CreateSupplier(dto);

                var created =
                    Assert.IsType<ObjectResult>(result);

                Assert.Equal(201, created.StatusCode);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                var supplier = await verifyContext.Suppliers
                    .AsNoTracking()
                    .SingleAsync(s => s.Name == name);

                Assert.Equal(
                    "0599000000",
                    supplier.Phone);

                Assert.Equal(
                    "supplier-test@example.invalid",
                    supplier.Email);

                Assert.Equal(
                    "Test Address",
                    supplier.Address);
            }
        }
        finally
        {
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await cleanupContext.Suppliers
                .Where(s => s.Name == name)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task CreateSupplier_EmptyName_ShouldReturnBadRequest()
    {
        var options = CreateOptions();

        await using var context = new AppDbContext(options);

        await VerifyDatabaseAsync(context);

        var dto = new CreateSupplierDto
        {
            Name = "   ",
            Phone = "0599000000",
            Email = "invalid-test@example.invalid",
            Address = "Test Address"
        };

        var controller =
            new SuppliersController(context);

        var result =
            await controller.CreateSupplier(dto);

        var badRequest =
            Assert.IsType<BadRequestObjectResult>(result);

        Assert.Equal(400, badRequest.StatusCode);

        Assert.Equal(
            "Supplier name is required.",
            badRequest.Value);

        await using var verifyContext =
            new AppDbContext(options);

        await VerifyDatabaseAsync(verifyContext);

        Assert.False(
            await verifyContext.Suppliers
                .AnyAsync(s =>
                    s.Email == "invalid-test@example.invalid"));
    }

    [Fact]
    public async Task UpdateSupplier_ValidData_ShouldUpdateSupplier()
    {
        var options = CreateOptions();

        string originalName = "SUPPLIER-OLD-" +
                              Guid.NewGuid().ToString("N");

        string updatedName = "SUPPLIER-NEW-" +
                             Guid.NewGuid().ToString("N");

        try
        {
            int supplierId;

            await using (var setupContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(setupContext);

                var supplier = new Supplier
                {
                    Name = originalName,
                    Phone = "0599111111",
                    Email = "before@example.invalid",
                    Address = "Old Address"
                };

                setupContext.Suppliers.Add(supplier);
                await setupContext.SaveChangesAsync();

                supplierId = supplier.SupplierId;
            }

            await using (var context = new AppDbContext(options))
            {
                await VerifyDatabaseAsync(context);

                var dto = new UpdateSupplierDto
                {
                    Name = updatedName,
                    Phone = "0599222222",
                    Email = "after@example.invalid",
                    Address = "New Address"
                };

                var controller =
                    new SuppliersController(context);

                var result = await controller.UpdateSupplier(
                    supplierId, dto);

                var ok = Assert.IsType<OkObjectResult>(result);

                Assert.Equal(200, ok.StatusCode);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                var supplier = await verifyContext.Suppliers
                    .AsNoTracking()
                    .SingleAsync(s => s.SupplierId == supplierId);

                Assert.Equal(updatedName, supplier.Name);
                Assert.Equal("0599222222", supplier.Phone);
                Assert.Equal("after@example.invalid", supplier.Email);
                Assert.Equal("New Address", supplier.Address);
            }
        }
        finally
        {
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await cleanupContext.Suppliers
                .Where(s =>
                    s.Name == originalName ||
                    s.Name == updatedName)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task DeleteSupplier_WithProducts_ShouldReturnConflict()
    {
        var options = CreateOptions();

        string supplierName = "SUPPLIER-PROTECTED-" +
                              Guid.NewGuid().ToString("N");

        string productSku = "SUPPLIER-PRODUCT-" +
                            Guid.NewGuid().ToString("N");

        int? supplierId = null;
        int? productId = null;

        try
        {
            await using (var setupContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(setupContext);

                var categoryId = await setupContext.Categories
                    .AsNoTracking()
                    .Select(c => c.CategoryId)
                    .FirstAsync();

                var supplier = new Supplier
                {
                    Name = supplierName,
                    Phone = "0599000000",
                    Email = "protected@example.invalid",
                    Address = "Test Address"
                };

                setupContext.Suppliers.Add(supplier);
                await setupContext.SaveChangesAsync();

                supplierId = supplier.SupplierId;

                var product = new Product
                {
                    Sku = productSku,
                    Name = "Supplier Protection Test Product",
                    Description = "Temporary test product",
                    CategoryId = categoryId,
                    SupplierId = supplier.SupplierId,
                    PurchasePrice = 10m,
                    SellingPrice = 20m,
                    Quantity = 10,
                    MinStockLevel = 2,
                    CreatedAt = DateTime.UtcNow
                };

                setupContext.Products.Add(product);
                await setupContext.SaveChangesAsync();

                productId = product.ProductId;
            }

            await using (var context = new AppDbContext(options))
            {
                await VerifyDatabaseAsync(context);

                var controller =
                    new SuppliersController(context);

                var result =
                    await controller.DeleteSupplier(
                        supplierId!.Value);

                var conflict =
                    Assert.IsType<ConflictObjectResult>(result);

                Assert.Equal(409, conflict.StatusCode);

                Assert.Equal(
                    "Cannot delete supplier because it contains products.",
                    conflict.Value);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                Assert.True(
                    await verifyContext.Suppliers
                        .AsNoTracking()
                        .AnyAsync(s =>
                            s.SupplierId == supplierId!.Value));

                Assert.True(
                    await verifyContext.Products
                        .AsNoTracking()
                        .AnyAsync(p =>
                            p.ProductId == productId!.Value &&
                            p.SupplierId == supplierId.Value));
            }
        }
        finally
        {
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await using var transaction =
                await cleanupContext.Database
                    .BeginTransactionAsync();

            await cleanupContext.Products
                .Where(p => p.Sku == productSku)
                .ExecuteDeleteAsync();

            await cleanupContext.Suppliers
                .Where(s => s.Name == supplierName)
                .ExecuteDeleteAsync();

            await transaction.CommitAsync();
        }
    }
}
    