
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace StockMaster.API.DTOs;

public class CreateSaleDto
{
    [Required(ErrorMessage = "Sale items are required.")]
    [MinLength(1,
        ErrorMessage = "A sale must contain at least one item.")]
    public List<CreateSaleItemDto> Items { get; set; } = new();
}
