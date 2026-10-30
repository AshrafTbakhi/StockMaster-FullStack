using System;
using System.Collections.Generic;

namespace StockMaster.API.Models;

public partial class Sale
{
    public int SaleId { get; set; }

    public DateTime SaleDate { get; set; }

    public int UserId { get; set; }

    public decimal TotalAmount { get; set; }

    public virtual ICollection<SaleItem> SaleItems { get; set; } = new List<SaleItem>();

    public virtual AppUser User { get; set; } = null!;
}
