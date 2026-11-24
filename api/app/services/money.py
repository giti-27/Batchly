from decimal import Decimal, ROUND_HALF_UP
from typing import Union

# Invariant I4 & I6: Strict Integer Paise & Decimal ROUND_HALF_UP
PAISE_ONE = Decimal("1")

def round_paise(val: Union[Decimal, int, str]) -> int:
    """
    Rounds any Decimal/numeric string representing paise to an integer paise
    using standard financial Decimal ROUND_HALF_UP.
    Never accepts float.
    """
    if isinstance(val, float):
        raise TypeError("Floating-point values are strictly forbidden for money in BATCHLY.")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    rounded = d.quantize(PAISE_ONE, rounding=ROUND_HALF_UP)
    return int(rounded)

def paise_to_rupees_decimal(paise: int) -> Decimal:
    """Converts integer paise to Decimal rupees with 2 decimal places."""
    return (Decimal(paise) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def paise_to_rupees_str(paise: int) -> str:
    """Formats integer paise as '₹X,XX,XX0.00' or standard decimal string."""
    rupees = paise_to_rupees_decimal(paise)
    return f"{rupees:.2f}"

def rupees_to_paise(rupees: Union[Decimal, int, str]) -> int:
    """Converts Rupees (Decimal or string) to integer paise."""
    if isinstance(rupees, float):
        raise TypeError("Floating-point values are strictly forbidden for money in BATCHLY.")
    d = Decimal(str(rupees)) if not isinstance(rupees, Decimal) else rupees
    return round_paise(d * Decimal("100"))
