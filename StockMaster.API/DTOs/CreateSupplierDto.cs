
using System.ComponentModel.DataAnnotations;

namespace StockMaster.API.DTOs;

public class CreateSupplierDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Phone]
    public string? Phone { get; set; }

    [EmailAddress]
    public string? Email { get; set; }

    public string? Address { get; set; }
}
