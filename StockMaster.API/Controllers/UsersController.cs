using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockMaster.API.Data;
using StockMaster.API.Models;

namespace StockMaster.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<AppUser> _passwordHasher;

    public UsersController(AppDbContext context, IPasswordHasher<AppUser> passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    private async Task<bool> IsCurrentAdminAsync()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var id) && id > 0 &&
            await _context.AppUsers.AsNoTracking().AnyAsync(u =>
                u.UserId == id && u.IsActive && u.Role == "Admin");
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        if (!await IsCurrentAdminAsync()) return Forbid();

        var users = await _context.AppUsers.AsNoTracking()
            .OrderBy(u => u.UserId)
            .Select(u => new
            {
                u.UserId,
                u.FullName,
                u.Email,
                u.Role,
                u.IsActive,
                u.CreatedAt
            }).ToListAsync();
        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (!await IsCurrentAdminAsync()) return Forbid();
        if (request == null || string.IsNullOrWhiteSpace(request.FullName) ||
            string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Name, email and password are required.");

        string name = request.FullName.Trim();
        string email = request.Email.Trim();
        if (name.Length > 150 || email.Length > 150)
            return BadRequest("Name or email exceeds maximum length.");
        if (!new EmailAddressAttribute().IsValid(email))
            return BadRequest("Invalid email address.");
        if (request.Password.Length < 12)
            return BadRequest("Password must contain at least 12 characters.");
        if (request.Password.Length > 128)
            return BadRequest("Password is too long.");
        if (request.Role != "Employee")
            return BadRequest("Only Employee accounts can be created. The system has one Admin.");
        if (await _context.AppUsers.AnyAsync(u => u.Email == email))
            return Conflict("Email already exists.");

        var user = new AppUser
        {
            FullName = name,
            Email = email,
            Role = "Employee",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            PasswordHash = ""
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        _context.AppUsers.Add(user);
        await _context.SaveChangesAsync();
        return StatusCode(201, new
        {
            Message = "User created successfully.",
            user.UserId,
            user.FullName,
            user.Email,
            user.Role,
            user.IsActive,
            user.CreatedAt
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
    {
        if (!await IsCurrentAdminAsync()) return Forbid();
        if (request == null) return BadRequest("User information is required.");

        var user = await _context.AppUsers.FindAsync(id);
        if (user == null) return NotFound("User not found.");
        if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Name and email are required.");
        string name = request.FullName.Trim();
        string email = request.Email.Trim();
        if (name.Length > 150 || email.Length > 150)
            return BadRequest("Name or email exceeds maximum length.");
        if (!new EmailAddressAttribute().IsValid(email))
            return BadRequest("Invalid email address.");
        if (await _context.AppUsers.AnyAsync(u => u.Email == email && u.UserId != id))
            return Conflict("Email already exists.");

        if (user.Role == "Admin")
        {
            if (request.Role != "Admin" || !request.IsActive)
                return Conflict("The only Admin cannot be demoted or deactivated.");
        }
        else if (request.Role != "Employee")
        {
            return BadRequest("Employees cannot be promoted to Admin.");
        }

        user.FullName = name;
        user.Email = email;
        user.IsActive = request.IsActive;
        // Role intentionally unchanged: exactly one existing Admin.
        await _context.SaveChangesAsync();
        return Ok(new
        {
            Message = "User updated successfully.",
            user.UserId,
            user.FullName,
            user.Email,
            user.Role,
            user.IsActive
        });
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateUserStatusRequest request)
    {
        if (!await IsCurrentAdminAsync()) return Forbid();
        if (request == null) return BadRequest("Status is required.");
        var user = await _context.AppUsers.FindAsync(id);
        if (user == null) return NotFound("User not found.");
        if (user.Role == "Admin" && !request.IsActive)
            return Conflict("The only Admin cannot be deactivated.");
        user.IsActive = request.IsActive;
        await _context.SaveChangesAsync();
        return Ok(new
        {
            Message = "User status updated successfully.",
            user.UserId,
            user.IsActive
        });
    }
}

public class CreateUserRequest
{
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string Role { get; set; } = "Employee";
}

public class UpdateUserRequest
{
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "Employee";
    public bool IsActive { get; set; }
}

public class UpdateUserStatusRequest
{
    public bool IsActive { get; set; }
}
