using System.ComponentModel.DataAnnotations;

namespace StockMaster.API.DTOs;

public class CreateStockMovementDto
{
    [Required]
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Required]
    [RegularExpression("^(IN|OUT)$")]
    public string MovementType { get; set; } = string.Empty;

    [Required]
    [Range(1, int.MaxValue)]
    public int Quantity { get; set; }

    [StringLength(300)]
    public string? Notes { get; set; }
}