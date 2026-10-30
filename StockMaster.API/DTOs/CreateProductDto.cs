using System.ComponentModel.DataAnnotations;

namespace StockMaster.API.DTOs;

public class CreateProductDto
{
    [Required]
    [StringLength(50)]
    public string Sku { get; set; } = string.Empty;

    [Required]
    [StringLength(150)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    [StringLength(300)]
    public string? ImageUrl { get; set; }

    [Range(1, int.MaxValue)]
    public int CategoryId { get; set; }

    public int? SupplierId { get; set; }

    [Range(typeof(decimal), "0", "9999999999999999.99")]
    public decimal PurchasePrice { get; set; }

    [Range(typeof(decimal), "0", "9999999999999999.99")]
    public decimal SellingPrice { get; set; }

    [Range(0, int.MaxValue)]
    public int Quantity { get; set; }

    [Range(0, int.MaxValue)]
    public int MinStockLevel { get; set; } = 5;
}
