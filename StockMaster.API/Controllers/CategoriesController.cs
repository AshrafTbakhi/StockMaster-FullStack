
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
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoriesController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/Categories
    // Admin and Employee
    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Categories
            .AsNoTracking()
            .Select(c => new
            {
                c.CategoryId,
                c.Name,
                c.Description
            })
            .ToListAsync();

        return Ok(categories);
    }

    // POST: api/Categories
    // Admin and Employee
    [HttpPost]
    public async Task<IActionResult> CreateCategory(
        [FromBody] CreateCategoryDto dto)
    {
        if (dto == null)
        {
            return BadRequest("Category data is required.");
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Category name is required.");
        }

        string name = dto.Name.Trim();

        if (name.Length > 100)
        {
            return BadRequest("Category name is too long.");
        }

        bool categoryExists = await _context.Categories
            .AnyAsync(c => c.Name == name);

        if (categoryExists)
        {
            return Conflict("Category already exists.");
        }

        var category = new Category
        {
            Name = name,
            Description = dto.Description
        };

        _context.Categories.Add(category);

        await _context.SaveChangesAsync();

        return StatusCode(201, new
        {
            Message = "Category created successfully.",
            category.CategoryId,
            category.Name,
            category.Description
        });
    }

    // PUT: api/Categories/1
    // Admin and Employee
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateCategory(
        int id,
        [FromBody] UpdateCategoryDto dto)
    {
        if (dto == null)
        {
            return BadRequest("Category data is required.");
        }

        var category = await _context.Categories
            .FindAsync(id);

        if (category == null)
        {
            return NotFound("Category not found.");
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("Category name is required.");
        }

        string name = dto.Name.Trim();

        if (name.Length > 100)
        {
            return BadRequest("Category name is too long.");
        }

        bool categoryExists = await _context.Categories
            .AnyAsync(c =>
                c.Name == name &&
                c.CategoryId != id);

        if (categoryExists)
        {
            return Conflict("Category already exists.");
        }

        category.Name = name;
        category.Description = dto.Description;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = "Category updated successfully.",
            category.CategoryId,
            category.Name,
            category.Description
        });
    }

    // DELETE: api/Categories/1
    // Admin only
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _context.Categories
            .FindAsync(id);

        if (category == null)
        {
            return NotFound("Category not found.");
        }

        bool hasProducts = await _context.Products
            .AnyAsync(p => p.CategoryId == id);

        if (hasProducts)
        {
            return Conflict(
                "Cannot delete category because it contains products.");
        }

        _context.Categories.Remove(category);

        await _context.SaveChangesAsync();

        return NoContent();
    }
}
