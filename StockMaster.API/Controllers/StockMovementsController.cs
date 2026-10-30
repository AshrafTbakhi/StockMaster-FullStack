
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
public class StockMovementsController : ControllerBase
{
    private readonly AppDbContext _context;

    public StockMovementsController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/StockMovements
    [HttpGet]
    public async Task<IActionResult> GetStockMovements()
    {
        var movements = await _context.StockMovements
            .AsNoTracking()
            .OrderByDescending(m => m.MovementDate)
            .ThenByDescending(m => m.MovementId)
            .Select(m => new
            {
                m.MovementId,
                m.ProductId,
                ProductName = m.Product.Name,
                m.UserId,
                UserName = m.User.FullName,
                m.MovementType,
                m.Quantity,
                m.MovementDate,
                m.Notes
            })
            .ToListAsync();

        return Ok(movements);
    }

    // POST: api/StockMovements
    [HttpPost]
    public async Task<IActionResult> CreateStockMovement(
        [FromBody] CreateStockMovementDto dto)
    {
        // Read the authenticated user's ID from JWT.
        var userIdClaim =
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdClaim, out int userId) ||
            userId <= 0)
        {
            return Unauthorized("Invalid authenticated user.");
        }

        // Ensure the user still exists and is active.
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

        // Validate request.
        if (dto == null)
        {
            return BadRequest("Movement data is required.");
        }

        if (dto.ProductId <= 0)
        {
            return BadRequest("Invalid product ID.");
        }

        string movementType =
            dto.MovementType?.Trim().ToUpperInvariant()
            ?? string.Empty;

        if (movementType != "IN" && movementType != "OUT")
        {
            return BadRequest(
                "Movement type must be IN or OUT.");
        }

        if (dto.Quantity <= 0)
        {
            return BadRequest(
                "Quantity must be greater than zero.");
        }

        // Start a serializable transaction.
        await using var transaction =
            await _context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable);

        // Find product.
        var product = await _context.Products
            .FirstOrDefaultAsync(p =>
                p.ProductId == dto.ProductId);

        if (product == null)
        {
            return NotFound("Product not found.");
        }

        // Calculate updated quantity.
        if (movementType == "IN")
        {
            if (product.Quantity >
                int.MaxValue - dto.Quantity)
            {
                return BadRequest(
                    "Quantity exceeds the maximum allowed value.");
            }

            product.Quantity += dto.Quantity;
        }
        else
        {
            if (product.Quantity < dto.Quantity)
            {
                return BadRequest(
                    "Insufficient stock quantity.");
            }

            product.Quantity -= dto.Quantity;
        }

        // Record movement using the authenticated user.
        var movement = new StockMovement
        {
            ProductId = dto.ProductId,
            UserId = userId,
            MovementType = movementType,
            Quantity = dto.Quantity,
            MovementDate = DateTime.Now,
            Notes = dto.Notes
        };

        _context.StockMovements.Add(movement);

        // Save stock and movement atomically.
        await _context.SaveChangesAsync();

        await transaction.CommitAsync();

        return StatusCode(201, new
        {
            Message = "Stock movement created successfully.",
            movement.MovementId,
            movement.ProductId,
            ProductName = product.Name,
            movement.UserId,
            movement.MovementType,
            movement.Quantity,
            CurrentStock = product.Quantity,
            movement.MovementDate,
            movement.Notes
        });
    }
}
