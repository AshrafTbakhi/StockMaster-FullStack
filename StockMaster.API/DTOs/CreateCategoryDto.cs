using System.ComponentModel.DataAnnotations;

namespace StockMaster.API.DTOs;

public class CreateCategoryDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }
}