
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
public class SuppliersController : ControllerBase
{
    private readonly AppDbContext _context;

    public SuppliersController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/Suppliers
    // Admin and Employee
    [HttpGet]
    public async Task<IActionResult> GetSuppliers()
    {
        var suppliers = await _context.Suppliers
            .AsNoTracking()
            .Select(s => new
            {
                s.SupplierId,
                s.Name,
                s.Phone,
                s.Email,
                s.Address
            })
            .ToListAsync();

        return Ok(suppliers);
    }

    // POST: api/Suppliers
    // Admin and Employee
    [HttpPost]
    public async Task<IActionResult> CreateSupplier(
        [FromBody] CreateSupplierDto dto)
    {
        if (dto == null ||
            string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Supplier name is required.");
        }

        string name = dto.Name.Trim();

        if (name.Length > 100)
        {
            return BadRequest("Supplier name is too long.");
        }

        var supplier = new Supplier
        {
            Name = name,
            Phone = dto.Phone,
            Email = dto.Email,
            Address = dto.Address
        };

        _context.Suppliers.Add(supplier);

        await _context.SaveChangesAsync();

        return StatusCode(201, new
        {
            Message = "Supplier created successfully.",
            supplier.SupplierId,
            supplier.Name,
            supplier.Phone,
            supplier.Email,
            supplier.Address
        });
    }

    // PUT: api/Suppliers/1
    // Admin and Employee
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateSupplier(
        int id,
        [FromBody] UpdateSupplierDto dto)
    {
        var supplier = await _context.Suppliers
            .FindAsync(id);

        if (supplier == null)
        {
            return NotFound("Supplier not found.");
        }

        if (dto == null ||
            string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Supplier name is required.");
        }

        string name = dto.Name.Trim();

        if (name.Length > 100)
        {
            return BadRequest("Supplier name is too long.");
        }

        supplier.Name = name;
        supplier.Phone = dto.Phone;
        supplier.Email = dto.Email;
        supplier.Address = dto.Address;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = "Supplier updated successfully.",
            supplier.SupplierId,
            supplier.Name,
            supplier.Phone,
            supplier.Email,
            supplier.Address
        });
    }

    // DELETE: api/Suppliers/1
    // Admin only
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSupplier(int id)
    {
        var supplier = await _context.Suppliers
            .FindAsync(id);

        if (supplier == null)
        {
            return NotFound("Supplier not found.");
        }

        bool hasProducts = await _context.Products
            .AnyAsync(p => p.SupplierId == id);

        if (hasProducts)
        {
            return Conflict(
                "Cannot delete supplier because it contains products.");
        }

        _context.Suppliers.Remove(supplier);

        await _context.SaveChangesAsync();

        return NoContent();
    }
}
