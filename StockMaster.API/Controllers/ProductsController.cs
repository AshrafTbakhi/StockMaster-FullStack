using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockMaster.API.Data;
using StockMaster.API.DTOs;
using StockMaster.API.Models;

namespace StockMaster.API.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,Employee")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetProducts()
    {
        var products = await _context.Products
            .AsNoTracking()
            .Select(p => new
            {
                p.ProductId,
                p.Sku,
                p.Name,
                p.Description,
                p.ImageUrl,
                p.CategoryId,
                p.SupplierId,
                p.PurchasePrice,
                p.SellingPrice,
                p.Quantity,
                p.MinStockLevel,
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(products);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProduct([FromBody] CreateProductDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Sku) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("SKU and Name are required.");

        string sku = dto.Sku.Trim();
        string name = dto.Name.Trim();

        if (sku.Length > 50 || name.Length > 150)
            return BadRequest("SKU or Name exceeds maximum length.");

        if (dto.PurchasePrice < 0 || dto.SellingPrice < 0 ||
            dto.Quantity < 0 || dto.MinStockLevel < 0)
            return BadRequest("Prices and quantities cannot be negative.");

        if (!TryNormalizeImageUrl(dto.ImageUrl, out var imageUrl))
            return BadRequest("ImageUrl must be an optional local path under /products/ ending in .png, .jpg, .jpeg or .webp.");

        bool skuExists = await _context.Products.AnyAsync(p => p.Sku == sku);
        if (skuExists) return Conflict("SKU already exists.");

        bool categoryExists = await _context.Categories.AnyAsync(c => c.CategoryId == dto.CategoryId);
        if (!categoryExists) return BadRequest("Invalid CategoryId.");

        if (dto.SupplierId.HasValue)
        {
            bool supplierExists = await _context.Suppliers.AnyAsync(s => s.SupplierId == dto.SupplierId.Value);
            if (!supplierExists) return BadRequest("Invalid SupplierId.");
        }

        var product = new Product
        {
            Sku = sku,
            Name = name,
            Description = dto.Description,
            ImageUrl = imageUrl,
            CategoryId = dto.CategoryId,
            SupplierId = dto.SupplierId,
            PurchasePrice = dto.PurchasePrice,
            SellingPrice = dto.SellingPrice,
            Quantity = dto.Quantity,
            MinStockLevel = dto.MinStockLevel
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return StatusCode(201, new
        {
            Message = "Product created successfully.",
            product.ProductId,
            product.Sku,
            product.Name
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, [FromBody] UpdateProductDto dto)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound("Product not found.");

        if (string.IsNullOrWhiteSpace(dto.Sku) || string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("SKU and Name are required.");

        string sku = dto.Sku.Trim();
        string name = dto.Name.Trim();

        if (sku.Length > 50 || name.Length > 150)
            return BadRequest("SKU or Name exceeds maximum length.");

        if (dto.PurchasePrice < 0 || dto.SellingPrice < 0 ||
            dto.Quantity < 0 || dto.MinStockLevel < 0)
            return BadRequest("Prices and quantities cannot be negative.");

        if (!TryNormalizeImageUrl(dto.ImageUrl, out var imageUrl))
            return BadRequest("ImageUrl must be an optional local path under /products/ ending in .png, .jpg, .jpeg or .webp.");

        bool skuExists = await _context.Products.AnyAsync(p => p.Sku == sku && p.ProductId != id);
        if (skuExists) return Conflict("SKU already exists.");

        bool categoryExists = await _context.Categories.AnyAsync(c => c.CategoryId == dto.CategoryId);
        if (!categoryExists) return BadRequest("Invalid CategoryId.");

        if (dto.SupplierId.HasValue)
        {
            bool supplierExists = await _context.Suppliers.AnyAsync(s => s.SupplierId == dto.SupplierId.Value);
            if (!supplierExists) return BadRequest("Invalid SupplierId.");
        }

        product.Sku = sku;
        product.Name = name;
        product.Description = dto.Description;
        product.ImageUrl = imageUrl;
        product.CategoryId = dto.CategoryId;
        product.SupplierId = dto.SupplierId;
        product.PurchasePrice = dto.PurchasePrice;
        product.SellingPrice = dto.SellingPrice;
        product.Quantity = dto.Quantity;
        product.MinStockLevel = dto.MinStockLevel;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = "Product updated successfully.",
            product.ProductId,
            product.Sku,
            product.Name
        });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound("Product not found.");

        bool hasSaleItems = await _context.SaleItems.AnyAsync(s => s.ProductId == id);
        bool hasStockMovements = await _context.StockMovements.AnyAsync(m => m.ProductId == id);
        if (hasSaleItems || hasStockMovements)
            return Conflict("Cannot delete product with sales or stock history.");

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private static bool TryNormalizeImageUrl(string? value, out string? normalized)
    {
        normalized = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        var path = value.Trim();
        if (path.Length > 300 || !path.StartsWith("/products/", StringComparison.Ordinal) ||
            path.Contains("..", StringComparison.Ordinal) || path.Contains('\\') ||
            path.Contains('?') || path.Contains('#') || path.Contains('%') ||
            path.Any(char.IsControl)) return false;

        var filename = path["/products/".Length..];
        if (filename.Length == 0 || filename.Contains('/') ||
            !filename.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.')) return false;

        var ext = Path.GetExtension(filename);
        if (!new[] { ".png", ".jpg", ".jpeg", ".webp" }.Contains(ext, StringComparer.OrdinalIgnoreCase)) return false;

        normalized = path;
        return true;
    }
}
