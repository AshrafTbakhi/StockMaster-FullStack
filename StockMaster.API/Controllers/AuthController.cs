
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StockMaster.API.Data;
using StockMaster.API.DTOs;
using StockMaster.API.Models;

namespace StockMaster.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<AppUser> _passwordHasher;
    private readonly IConfiguration _configuration;

    public AuthController(
        AppDbContext context,
        IPasswordHasher<AppUser> passwordHasher,
        IConfiguration configuration)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var email = request.Email.Trim();

        var user = await _context.AppUsers
            .FirstOrDefaultAsync(u => u.Email == email);

        // Do not reveal whether the email exists or is disabled.
        if (user == null || !user.IsActive)
        {
            return Unauthorized(
                "Invalid email or password.");
        }

        PasswordVerificationResult verificationResult;

        try
        {
            verificationResult =
                _passwordHasher.VerifyHashedPassword(
                    user,
                    user.PasswordHash,
                    request.Password);
        }
        catch (FormatException)
        {
            return Unauthorized(
                "Invalid email or password.");
        }
        catch (ArgumentException)
        {
            return Unauthorized(
                "Invalid email or password.");
        }

        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return Unauthorized(
                "Invalid email or password.");
        }

        var jwtKey = _configuration["Jwt:Key"];
        var jwtIssuer = _configuration["Jwt:Issuer"];
        var jwtAudience = _configuration["Jwt:Audience"];

        if (string.IsNullOrWhiteSpace(jwtKey) ||
            string.IsNullOrWhiteSpace(jwtIssuer) ||
            string.IsNullOrWhiteSpace(jwtAudience))
        {
            return StatusCode(
                500,
                "JWT configuration is missing.");
        }

        var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

        if (keyBytes.Length < 32)
        {
            return StatusCode(
                500,
                "JWT signing key is invalid.");
        }

        var claims = new List<Claim>
        {
            new Claim(
                JwtRegisteredClaimNames.Sub,
                user.UserId.ToString()),

            new Claim(
                ClaimTypes.NameIdentifier,
                user.UserId.ToString()),

            new Claim(
                ClaimTypes.Name,
                user.FullName),

            new Claim(
                ClaimTypes.Email,
                user.Email),

            new Claim(
                ClaimTypes.Role,
                user.Role),

            new Claim(
                JwtRegisteredClaimNames.Jti,
                Guid.NewGuid().ToString())
        };

        var signingKey = new SymmetricSecurityKey(keyBytes);

        var credentials = new SigningCredentials(
            signingKey,
            SecurityAlgorithms.HmacSha256);

        var expiresAt = DateTime.UtcNow.AddMinutes(60);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: credentials);

        var tokenString =
            new JwtSecurityTokenHandler().WriteToken(token);

        return Ok(new
        {
            Message = "Login successful.",
            Token = tokenString,
            ExpiresAt = expiresAt,
            User = new
            {
                user.UserId,
                user.FullName,
                user.Email,
                user.Role
            }
        });
    }
}
