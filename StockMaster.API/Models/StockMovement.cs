using System;
using System.Collections.Generic;

namespace StockMaster.API.Models;

public partial class StockMovement
{
    public int MovementId { get; set; }

    public int ProductId { get; set; }

    public int UserId { get; set; }

    public string MovementType { get; set; } = null!;

    public int Quantity { get; set; }

    public DateTime MovementDate { get; set; }

    public string? Notes { get; set; }

    public virtual Product Product { get; set; } = null!;

    public virtual AppUser User { get; set; } = null!;
}
