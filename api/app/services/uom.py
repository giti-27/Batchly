from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Union

class UnitError(Exception):
    """Raised when an invalid unit or cross-dimensional conversion is requested."""
    pass

# Base units
BASE_WEIGHT = "g"
BASE_VOLUME = "ml"
BASE_COUNT = "pcs"
BASE_PACKET = "packet"

STANDARD_CARTON_PACKETS = Decimal("20")

# Dimension groups
DIMENSIONS = {
    "g": "weight",
    "kg": "weight",
    "ml": "volume",
    "L": "volume",
    "l": "volume",
    "pcs": "count",
    "piece": "count",
    "pieces": "count",
    "packet": "finished_good",
    "packets": "finished_good",
    "carton": "carton_pack",
    "cartons": "carton_pack"
}

def get_dimension(unit: str) -> str:
    u = unit.strip()
    if u in DIMENSIONS:
        return DIMENSIONS[u]
    raise UnitError(f"Unknown unit of measure: '{unit}'")

def to_base(qty: Union[Decimal, int, str], unit: str, item_type: Optional[str] = None, packets_per_carton: Decimal = STANDARD_CARTON_PACKETS) -> Decimal:
    """
    Converts input quantity and unit to its canonical base unit.
    Weight -> grams (g)
    Volume -> millilitres (ml)
    Count -> pieces (pcs)
    Finished goods / Packets -> packets (packet)
    Cartons -> converted to packets using packets_per_carton
    """
    if isinstance(qty, float):
        raise TypeError("Floating-point values are strictly forbidden for quantities in BATCHLY.")
    
    d_qty = Decimal(str(qty)) if not isinstance(qty, Decimal) else qty
    u = unit.strip()
    dim = get_dimension(u)
    
    # Check item_type if provided
    if item_type:
        item_t = item_type.upper()
        if item_t == "RAW":
            if dim not in ["weight", "volume", "count"]:
                raise UnitError(f"Invalid unit '{unit}' for RAW material.")
        elif item_t == "PACK":
            if dim not in ["count", "weight", "carton_pack"]:
                raise UnitError(f"Invalid unit '{unit}' for PACK material.")
        elif item_t == "FG":
            if dim not in ["finished_good", "carton_pack"]:
                raise UnitError(f"Invalid unit '{unit}' for Finished Goods.")

    if u == "kg":
        return (d_qty * Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u == "g":
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["L", "l"]:
        return (d_qty * Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u == "ml":
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["pcs", "piece", "pieces"]:
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["packet", "packets"]:
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["carton", "cartons"]:
        return (d_qty * packets_per_carton).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    else:
        raise UnitError(f"Unsupported unit: {unit}")

def from_base(qty_base: Union[Decimal, int, str], target_unit: str, packets_per_carton: Decimal = STANDARD_CARTON_PACKETS) -> Decimal:
    """Converts a base unit quantity into the target display unit."""
    if isinstance(qty_base, float):
        raise TypeError("Floating-point values are strictly forbidden for quantities in BATCHLY.")
    d_qty = Decimal(str(qty_base)) if not isinstance(qty_base, Decimal) else qty_base
    u = target_unit.strip()
    
    if u == "kg":
        return (d_qty / Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u == "g":
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["L", "l"]:
        return (d_qty / Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u == "ml":
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["pcs", "piece", "pieces"]:
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["packet", "packets"]:
        return d_qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    elif u in ["carton", "cartons"]:
        return (d_qty / packets_per_carton).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    else:
        raise UnitError(f"Unsupported target unit: {target_unit}")
