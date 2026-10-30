
using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using StockMaster.API.Data;
using StockMaster.API.Models;

const string expectedDatabase = "StockMasterDB_Test";
const string expectedServer = "DESKTOP-7SJ3Q5F";
const string employeeRole = "Employee";

Console.WriteLine("==================================");
Console.WriteLine("       StockMaster DevTools       ");
Console.WriteLine("==================================");
Console.WriteLine();
Console.WriteLine("Create a development employee account.");
Console.WriteLine($"Database: {expectedDatabase}");
Console.WriteLine($"Server: {expectedServer}");
Console.WriteLine();

var connectionStringBuilder = new SqlConnectionStringBuilder
{
    DataSource = expectedServer,
    InitialCatalog = expectedDatabase,
    IntegratedSecurity = true,
    TrustServerCertificate = true,
    Encrypt = true
};

var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseSqlServer(connectionStringBuilder.ConnectionString)
    .Options;

try
{
    await using var context = new AppDbContext(options);

    var connection = context.Database.GetDbConnection();

    if (!string.Equals(
        connection.Database,
        expectedDatabase,
        StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "SAFETY ERROR: Unexpected database.");
    }

    if (!string.Equals(
        connection.DataSource,
        expectedServer,
        StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException(
            "SAFETY ERROR: Unexpected SQL Server.");
    }

    if (!await context.Database.CanConnectAsync())
    {
        throw new InvalidOperationException(
            "Cannot connect to the test database.");
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

        var actualDatabase = reader.GetString(0);
        var actualServer = reader.GetString(1);

        if (!string.Equals(
            actualDatabase,
            expectedDatabase,
            StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "SAFETY ERROR: Connected to unexpected database.");
        }

        if (!string.Equals(
            actualServer,
            expectedServer,
            StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "SAFETY ERROR: Connected to unexpected server.");
        }
    }
    finally
    {
        await context.Database.CloseConnectionAsync();
    }

    Console.WriteLine("Database safety check: PASSED");
    Console.WriteLine();

    Console.Write("Employee full name: ");
    var fullName = Console.ReadLine()?.Trim();

    Console.Write("Employee email: ");
    var email = Console.ReadLine()?.Trim();

    if (string.IsNullOrWhiteSpace(fullName) ||
        fullName.Length > 150 ||
        string.IsNullOrWhiteSpace(email) ||
        email.Length > 150 ||
        !new EmailAddressAttribute().IsValid(email))
    {
        Console.WriteLine("Invalid name or email.");
        return;
    }

    var exists = await context.AppUsers
        .AnyAsync(u => u.Email == email);

    if (exists)
    {
        Console.WriteLine(
            "An account with this email already exists.");
        return;
    }

    Console.Write("Employee password: ");
    var password = ReadPassword();

    Console.WriteLine();

    if (password.Length < 12 ||
        password.Length > 128)
    {
        Console.WriteLine(
            "Password must be between 12 and 128 characters.");
        return;
    }

    Console.Write("Confirm password: ");
    var confirmation = ReadPassword();

    Console.WriteLine();

    if (password != confirmation)
    {
        Console.WriteLine("Passwords do not match.");
        return;
    }

    Console.WriteLine();
    Console.WriteLine("Account summary:");
    Console.WriteLine($"Name: {fullName}");
    Console.WriteLine($"Email: {email}");
    Console.WriteLine($"Role: {employeeRole}");
    Console.WriteLine($"Database: {expectedDatabase}");
    Console.WriteLine();
    Console.Write("Type CREATE to confirm: ");

    if (Console.ReadLine() != "CREATE")
    {
        Console.WriteLine("Operation cancelled.");
        return;
    }

    var user = new AppUser
    {
        FullName = fullName,
        Email = email,
        Role = employeeRole,
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    var hasher = new PasswordHasher<AppUser>();

    user.PasswordHash =
        hasher.HashPassword(user, password);

    context.AppUsers.Add(user);

    await context.SaveChangesAsync();

    Console.WriteLine();
    Console.WriteLine(
        "Employee account created successfully.");
    Console.WriteLine($"User ID: {user.UserId}");
    Console.WriteLine($"Email: {user.Email}");
    Console.WriteLine($"Role: {user.Role}");
}
catch (Exception ex)
{
    Console.WriteLine();
    Console.WriteLine($"ERROR: {ex.Message}");
}

static string ReadPassword()
{
    var password = new StringBuilder();

    while (true)
    {
        var key = Console.ReadKey(intercept: true);

        if (key.Key == ConsoleKey.Enter)
        {
            break;
        }

        if (key.Key == ConsoleKey.Backspace)
        {
            if (password.Length > 0)
            {
                password.Length--;
            }

            continue;
        }

        if (!char.IsControl(key.KeyChar))
        {
            password.Append(key.KeyChar);
        }
    }

    return password.ToString();
}
