
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

public class CategoriesIntegrationTests
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
    public async Task CreateCategory_ValidData_ShouldCreateCategory()
    {
        var options = CreateOptions();

        string name = "CATEGORY-TEST-" +
                      Guid.NewGuid().ToString("N");

        try
        {
            await using (var context = new AppDbContext(options))
            {
                await VerifyDatabaseAsync(context);

                var dto = new CreateCategoryDto
                {
                    Name = name,
                    Description = "Temporary category test"
                };

                var controller =
                    new CategoriesController(context);

                var result =
                    await controller.CreateCategory(dto);

                var created =
                    Assert.IsType<ObjectResult>(result);

                Assert.Equal(201, created.StatusCode);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                var category = await verifyContext.Categories
                    .AsNoTracking()
                    .SingleAsync(c => c.Name == name);

                Assert.Equal(
                    "Temporary category test",
                    category.Description);
            }
        }
        finally
        {
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await cleanupContext.Categories
                .Where(c => c.Name == name)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task CreateCategory_DuplicateName_ShouldReturnConflict()
    {
        var options = CreateOptions();

        string name = "CATEGORY-DUPLICATE-" +
                      Guid.NewGuid().ToString("N");

        try
        {
            await using (var setupContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(setupContext);

                setupContext.Categories.Add(new Category
                {
                    Name = name,
                    Description = "Original category"
                });

                await setupContext.SaveChangesAsync();
            }

            await using (var context = new AppDbContext(options))
            {
                await VerifyDatabaseAsync(context);

                var dto = new CreateCategoryDto
                {
                    Name = name,
                    Description = "Duplicate category"
                };

                var controller =
                    new CategoriesController(context);

                var result =
                    await controller.CreateCategory(dto);

                var conflict =
                    Assert.IsType<ConflictObjectResult>(result);

                Assert.Equal(409, conflict.StatusCode);
                Assert.Equal(
                    "Category already exists.",
                    conflict.Value);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                var categories = await verifyContext.Categories
                    .AsNoTracking()
                    .Where(c => c.Name == name)
                    .ToListAsync();

                Assert.Single(categories);
                Assert.Equal(
                    "Original category",
                    categories[0].Description);
            }
        }
        finally
        {
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await cleanupContext.Categories
                .Where(c => c.Name == name)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task UpdateCategory_ValidData_ShouldUpdateCategory()
    {
        var options = CreateOptions();

        string originalName = "CATEGORY-OLD-" +
                              Guid.NewGuid().ToString("N");

        string updatedName = "CATEGORY-NEW-" +
                             Guid.NewGuid().ToString("N");

        int? categoryId = null;

        try
        {
            await using (var setupContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(setupContext);

                var category = new Category
                {
                    Name = originalName,
                    Description = "Before update"
                };

                setupContext.Categories.Add(category);
                await setupContext.SaveChangesAsync();

                categoryId = category.CategoryId;
            }

            await using (var context = new AppDbContext(options))
            {
                await VerifyDatabaseAsync(context);

                var dto = new UpdateCategoryDto
                {
                    Name = updatedName,
                    Description = "After update"
                };

                var controller =
                    new CategoriesController(context);

                var result = await controller.UpdateCategory(
                    categoryId!.Value, dto);

                var ok = Assert.IsType<OkObjectResult>(result);

                Assert.Equal(200, ok.StatusCode);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                var category = await verifyContext.Categories
                    .AsNoTracking()
                    .SingleAsync(c =>
                        c.CategoryId == categoryId!.Value);

                Assert.Equal(updatedName, category.Name);
                Assert.Equal(
                    "After update",
                    category.Description);
            }
        }
        finally
        {
            await using var cleanupContext =
                new AppDbContext(options);

            await VerifyDatabaseAsync(cleanupContext);

            await cleanupContext.Categories
                .Where(c =>
                    c.Name == originalName ||
                    c.Name == updatedName)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task DeleteCategory_WithProducts_ShouldReturnConflict()
    {
        var options = CreateOptions();

        string categoryName = "CATEGORY-PROTECTED-" +
                              Guid.NewGuid().ToString("N");

        string productSku = "CATEGORY-PRODUCT-" +
                            Guid.NewGuid().ToString("N");

        int? categoryId = null;
        int? productId = null;

        try
        {
            await using (var setupContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(setupContext);

                var category = new Category
                {
                    Name = categoryName,
                    Description = "Category with a product"
                };

                setupContext.Categories.Add(category);
                await setupContext.SaveChangesAsync();

                categoryId = category.CategoryId;

                var product = new Product
                {
                    Sku = productSku,
                    Name = "Category Protection Test Product",
                    Description = "Temporary test product",
                    CategoryId = category.CategoryId,
                    SupplierId = null,
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
                    new CategoriesController(context);

                var result =
                    await controller.DeleteCategory(
                        categoryId!.Value);

                var conflict =
                    Assert.IsType<ConflictObjectResult>(result);

                Assert.Equal(409, conflict.StatusCode);

                Assert.Equal(
                    "Cannot delete category because it contains products.",
                    conflict.Value);
            }

            await using (var verifyContext =
                new AppDbContext(options))
            {
                await VerifyDatabaseAsync(verifyContext);

                Assert.True(
                    await verifyContext.Categories
                        .AsNoTracking()
                        .AnyAsync(c =>
                            c.CategoryId == categoryId!.Value));

                Assert.True(
                    await verifyContext.Products
                        .AsNoTracking()
                        .AnyAsync(p =>
                            p.ProductId == productId!.Value &&
                            p.CategoryId == categoryId.Value));
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

            await cleanupContext.Categories
                .Where(c => c.Name == categoryName)
                .ExecuteDeleteAsync();

            await transaction.CommitAsync();
        }
    }
}
