using System;
using System.Collections.Generic;

namespace StockMaster.API.Models;

public partial class Product
{
    public int ProductId { get; set; }
    public string Sku { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int CategoryId { get; set; }
    public int? SupplierId { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal SellingPrice { get; set; }
    public int Quantity { get; set; }
    public int MinStockLevel { get; set; }
    public DateTime CreatedAt { get; set; }
    public virtual Category Category { get; set; } = null!;
    public virtual ICollection<SaleItem> SaleItems { get; set; } = new List<SaleItem>();
    public virtual ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
    public virtual Supplier? Supplier { get; set; }
}
