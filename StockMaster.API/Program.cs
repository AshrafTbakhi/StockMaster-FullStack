
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StockMaster.API.Data;
using StockMaster.API.Models;

var builder = WebApplication.CreateBuilder(args);

// Database configuration
var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Database connection string is missing.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddControllers();

builder.Services.AddScoped<IPasswordHasher<AppUser>,
    PasswordHasher<AppUser>>();

// CORS configuration
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

if (builder.Environment.IsProduction() &&
    allowedOrigins.Length == 0)
{
    throw new InvalidOperationException(
        "Production CORS origins are not configured.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("StockMasterFrontend", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    });
});

// JWT configuration
var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

if (string.IsNullOrWhiteSpace(jwtKey) ||
    string.IsNullOrWhiteSpace(jwtIssuer) ||
    string.IsNullOrWhiteSpace(jwtAudience))
{
    throw new InvalidOperationException(
        "JWT configuration is missing.");
}

var keyBytes = Encoding.UTF8.GetBytes(jwtKey);

if (keyBytes.Length < 32)
{
    throw new InvalidOperationException(
        "JWT signing key must be at least 32 bytes.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.SaveToken = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),

            ValidateLifetime = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,

            ClockSkew = TimeSpan.FromSeconds(30)
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userIdValue = context.Principal?
                    .FindFirstValue(ClaimTypes.NameIdentifier);

                var tokenRole = context.Principal?
                    .FindFirstValue(ClaimTypes.Role);

                if (!int.TryParse(userIdValue, out var userId) ||
                    userId <= 0 ||
                    (tokenRole != "Admin" &&
                     tokenRole != "Employee"))
                {
                    context.Fail(
                        "Invalid user identity or role.");
                    return;
                }

                var db = context.HttpContext.RequestServices
                    .GetRequiredService<AppDbContext>();

                var account = await db.AppUsers
                    .AsNoTracking()
                    .Where(user => user.UserId == userId)
                    .Select(user => new
                    {
                        user.IsActive,
                        user.Role
                    })
                    .SingleOrDefaultAsync(
                        context.HttpContext.RequestAborted);

                if (account == null ||
                    !account.IsActive ||
                    account.Role != tokenRole)
                {
                    context.Fail(
                        "User account is inactive or permissions have changed.");
                }
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Development database safety checks
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();

    var context = scope.ServiceProvider
        .GetRequiredService<AppDbContext>();

    var logger = scope.ServiceProvider
        .GetRequiredService<ILogger<Program>>();

    var connection = context.Database.GetDbConnection();

    logger.LogInformation(
        "================================");

    logger.LogInformation(
        "STOCKMASTER DATABASE CHECK");

    logger.LogInformation(
        "ACTIVE DATABASE: {Database}",
        connection.Database);

    logger.LogInformation(
        "DATABASE SERVER: {Server}",
        connection.DataSource);

    logger.LogInformation(
        "================================");

    if (!string.Equals(
        connection.Database,
        "StockMasterDB_Test",
        StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "SAFETY ERROR: Development must use StockMasterDB_Test.");
    }

    if (!await context.Database.CanConnectAsync())
    {
        throw new InvalidOperationException(
            "DATABASE ERROR: Cannot connect to StockMasterDB_Test.");
    }

    var actualDatabase =
        context.Database.GetDbConnection().Database;

    if (!string.Equals(
        actualDatabase,
        "StockMasterDB_Test",
        StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "SAFETY ERROR: Unexpected database connection.");
    }

    logger.LogInformation(
        "DATABASE CONNECTION: SUCCESS");

    logger.LogInformation(
        "DATABASE SAFETY CHECK: PASSED");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseCors("StockMasterFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
