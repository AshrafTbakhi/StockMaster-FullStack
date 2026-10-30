
using System.Data;
using System.Security.Claims;
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
public class SalesController : ControllerBase
{
    private readonly AppDbContext _context;

    public SalesController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/Sales
    [HttpGet]
    public async Task<IActionResult> GetSales()
    {
        var sales = await _context.Sales
            .AsNoTracking()
            .OrderByDescending(s => s.SaleDate)
            .ThenByDescending(s => s.SaleId)
            .Select(s => new
            {
                s.SaleId,
                s.SaleDate,
                s.UserId,
                UserName = s.User.FullName,
                s.TotalAmount
            })
            .ToListAsync();

        return Ok(sales);
    }

    // GET: api/Sales/1
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetSaleById(int id)
    {
        if (id <= 0)
        {
            return BadRequest("Invalid sale ID.");
        }

        var sale = await _context.Sales
            .AsNoTracking()
            .Where(s => s.SaleId == id)
            .Select(s => new
            {
                s.SaleId,
                s.SaleDate,
                s.UserId,
                UserName = s.User.FullName,
                s.TotalAmount,
                Items = s.SaleItems.Select(item => new
                {
                    item.SaleItemId,
                    item.ProductId,
                    ProductName = item.Product.Name,
                    item.Quantity,
                    item.UnitPrice,
                    item.LineTotal
                }).ToList()
            })
            .FirstOrDefaultAsync();

        if (sale == null)
        {
            return NotFound("Sale not found.");
        }

        return Ok(sale);
    }

    // POST: api/Sales
    [HttpPost]
    public async Task<IActionResult> CreateSale(
        [FromBody] CreateSaleDto dto)
    {
        // Get the user ID from the authenticated JWT.
        var userIdClaim =
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out int userId) ||
            userId <= 0)
        {
            return Unauthorized("Invalid authenticated user.");
        }

        // Validate sale items.
        if (dto == null ||
            dto.Items == null ||
            dto.Items.Count == 0)
        {
            return BadRequest(
                "Sale must contain at least one item.");
        }

        if (dto.Items.Any(item =>
            item.ProductId <= 0 ||
            item.Quantity <= 0))
        {
            return BadRequest(
                "Product IDs and quantities must be positive.");
        }

        // Prevent duplicate products.
        var productIds = dto.Items
            .Select(item => item.ProductId)
            .ToList();

        if (productIds.Distinct().Count() != productIds.Count)
        {
            return BadRequest(
                "Duplicate products are not allowed.");
        }

        // Ensure the authenticated user is still active.
        bool userExists = await _context.AppUsers
            .AsNoTracking()
            .AnyAsync(u =>
                u.UserId == userId &&
                u.IsActive &&
                (u.Role == "Admin" ||
                 u.Role == "Employee"));

        if (!userExists)
        {
            return Unauthorized(
                "Authenticated user is no longer active.");
        }

        // Start a serializable transaction.
        await using var transaction =
            await _context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable);

        // Load products in a consistent order.
        var products = await _context.Products
            .Where(p => productIds.Contains(p.ProductId))
            .OrderBy(p => p.ProductId)
            .ToListAsync();

        if (products.Count != productIds.Count)
        {
            return NotFound(
                "One or more products were not found.");
        }

        decimal totalAmount = 0;

        var saleItems = new List<SaleItem>();
        var movements = new List<StockMovement>();

        DateTime saleDate = DateTime.Now;

        foreach (var product in products)
        {
            var requestedItem = dto.Items.First(item =>
                item.ProductId == product.ProductId);

            // Check available stock.
            if (product.Quantity < requestedItem.Quantity)
            {
                return BadRequest(
                    $"Insufficient stock for product {product.ProductId}.");
            }

            // Validate selling price.
            if (product.SellingPrice < 0)
            {
                return BadRequest(
                    $"Invalid selling price for product {product.ProductId}.");
            }

            decimal lineTotal;

            try
            {
                lineTotal = checked(
                    product.SellingPrice *
                    requestedItem.Quantity);

                totalAmount = checked(
                    totalAmount + lineTotal);
            }
            catch (OverflowException)
            {
                return BadRequest(
                    "Sale total exceeds the allowed value.");
            }

            // SQL Server decimal(18,2) maximum.
            if (totalAmount > 9999999999999999.99m)
            {
                return BadRequest(
                    "Sale total exceeds database precision.");
            }

            // Deduct product quantity.
            product.Quantity -= requestedItem.Quantity;

            // Create sale item.
            saleItems.Add(new SaleItem
            {
                ProductId = product.ProductId,
                Quantity = requestedItem.Quantity,
                UnitPrice = product.SellingPrice
            });

            // Record OUT movement for the logged-in user.
            movements.Add(new StockMovement
            {
                ProductId = product.ProductId,
                UserId = userId,
                MovementType = "OUT",
                Quantity = requestedItem.Quantity,
                MovementDate = saleDate,
                Notes = "Stock deducted from sale"
            });
        }

        // Create sale for the logged-in user.
        var sale = new Sale
        {
            UserId = userId,
            SaleDate = saleDate,
            TotalAmount = totalAmount,
            SaleItems = saleItems
        };

        // Save invoice and stock movements together.
        _context.Sales.Add(sale);
        _context.StockMovements.AddRange(movements);

        await _context.SaveChangesAsync();

        // Commit the transaction.
        await transaction.CommitAsync();

        // Return created invoice.
        return StatusCode(201, new
        {
            Message = "Sale created successfully.",
            sale.SaleId,
            sale.SaleDate,
            sale.UserId,
            sale.TotalAmount,
            Items = saleItems.Select(item => new
            {
                item.ProductId,
                item.Quantity,
                item.UnitPrice,
                LineTotal =
                    item.Quantity * item.UnitPrice
            })
        });
    }
}
