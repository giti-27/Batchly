# BATCHLY — Technical Design Note
**Intelligent Order-to-Audit Manufacturing Operations Platform**
*Prepared for Gitika · NIT Trichy CDI Winter Internship 2026*

---

## 1. Executive Summary & Core Invariants
BATCHLY is a ledger-first manufacturing operations platform designed for food & snack manufacturing. The system connects the **Sales Loop** (Order $\to$ Admin Verification $\to$ GST Invoice $\to$ FEFO Dispatch $\to$ Payment Allocation $\to$ Receivables Ageing) with the **Production Loop** (Purchasing $\to$ BOM Material Issue $\to$ Production Run $\to$ Finished Goods Receipt $\to$ Variance Analysis $\to$ Costing).

### Fundamental Invariants
1. **Ledger-First Inventory (I1, I2):** Stock is derived strictly from the append-only `stock_ledger` table ($\text{Balance} = \sum \Delta \text{qty}$). Physical row updates or deletes on posted stock ledger records are blocked by database triggers. `stock_balance` and `batch_balance` act as transactional caches for fast reads and concurrency row locks (`SELECT ... FOR UPDATE`).
2. **Strict Integer Paise Financials (I4, I6):** All monetary amounts are stored as integer paise (`BIGINT`). Line unit rates use high-precision decimals (`NUMERIC(18,6)` paise per base unit). No floating-point types exist in financial or stock calculations. GST is rounded per line using `ROUND_HALF_UP` and then summed.
3. **Normalized Base Units (I5):** Every item is stored in a single fundamental base unit:
   - Solid Raw Materials: Grams (`g`)
   - Liquids: Millilitres (`ml`)
   - Countables: Pieces (`pcs`)
   - Finished Goods: Packets (`packet`)
   Cartons and kilograms are boundary display/entry units converted via strictly validated conversion factors.

---

## 2. Entity-Relationship Architecture
```
  +------------------+         1:N         +------------------+
  |    customers     |-------------------->|      orders      |
  +------------------+                     +------------------+
          |                                         | 1:N
          |                                +------------------+
          |                                |   order_lines    |
          |                                +------------------+
          |                                         | 1:1
          | 1:N                            +------------------+
          +------------------------------->|     invoices     |
          |                                +------------------+
          |                                         | 1:N
          |                                +------------------+
          |                                |   invoice_lines  |
          |                                +------------------+
          | 1:N                                     | 1:N
          |                                +------------------+
          +------------------------------->|    dispatches    |
          |                                +------------------+
          | 1:N                                     |
          +-------------------+                     |
          |     payments      |                     |
          +-------------------+                     |
                    | 1:N                           |
          +-------------------+                     |
          |payment_allocations|                     |
          +-------------------+                     |
                                                    |
  +------------------+         1:N                  v
  |      items       |-------------------->+------------------+
  +------------------+                     |   stock_ledger   |
          | 1:N                            +------------------+
  +------------------+                              ^
  |     batches      |------------------------------+
  +------------------+         1:N                  |
          ^                                         |
          |                                         |
  +------------------+         1:N                  |
  | production_runs  |------------------------------+
  +------------------+
     | 1:N       | 1:N
     v           v
+-----------+ +--------------+
|run_consump| |run_overheads |
+-----------+ +--------------+
```

---

## 3. Stock Ledger & Inventory Mechanics
Every movement creates an immutable ledger row:
$$\Delta \text{qty} \in \{+\text{qty}, -\text{qty}\}$$
- Movement Types: `OPENING`, `PURCHASE`, `ISSUE`, `RETURN_TO_STOCK`, `SCRAP`, `PRODUCTION_IN`, `DISPATCH`, `SALES_RETURN`, `ADJUSTMENT`, `REVERSAL`.
- **Database Trigger:** An `AFTER UPDATE OR DELETE` trigger on `stock_ledger` unconditionally raises an exception for posted rows.
- **Cache Synchronization & Reconciliation:** Every ledger insert updates `stock_balance` and `batch_balance` within the same transaction. The `/admin/reconcile` endpoint verifies that:
$$\text{stock\_balance.qty} \equiv \sum_{\text{ledger}} \text{qty\_delta} \quad \text{and} \quad \text{batch\_balance.qty} \equiv \sum_{\text{batch ledger}} \text{qty\_delta}$$

---

## 4. Production, BOM & Costing Methodology
- **Dynamic BOM Architecture:** Murukku 200g standard batch consumes 40,000g flour output. Packaging lines support `PER_BATCH`, `PER_PACKET`, and `PER_CARTON`. For a 500g product sharing the same family, expected yield becomes $40,000 / 500 = 80$ packets, recalculating pouch and carton needs automatically.
- **Perpetual Moving Weighted Average:** 
$$\bar{C}_{\text{new}} = \frac{Q_{\text{old}} \cdot \bar{C}_{\text{old}} + Q_{\text{new}} \cdot C_{\text{purchase}}}{Q_{\text{old}} + Q_{\text{new}}}$$
Batches are decoupled from inventory valuation and used solely for traceability, expiry, and FEFO allocation.
- **Run Cost Absorption:**
$$\text{Cost Per Packet} = \frac{\sum (\text{Actual Consumed Qty} \times \text{Snapshot Unit Cost}) + \text{Labour Overheads} + \text{Power Overheads}}{\text{Actual Good Packets Produced}}$$
Damaged packaging is absorbed into the cost of good output. Intermediate calculations preserve high precision, stored unrounded, displayed to 2 decimal places.

---

## 5. Sales, Concurrency & GST Billing
- **Idempotency (I10):** Orders accept a client-generated UUID (`client_uuid`). Re-transmissions return the existing order safely without duplicate rows.
- **Stock Reservation & Approval Concurrency:** Upon admin approval, `reserved_qty` is incremented. Available finished goods stock is calculated as:
$$\text{Available FG} = \text{On-Hand FG} - \text{Reserved FG}$$
Approval and dispatch enforce deterministic item sorting (`ORDER BY item_id ASC`) with pessimistic row locking (`SELECT ... FOR UPDATE`) to eliminate race conditions and deadlocks.
- **FEFO Dispatch Allocation:** Dispatches automatically select active batches sorted by `expiry_date ASC, mfg_date ASC`. Quarantined and expired batches are excluded.
- **GST Determination:** Derived deterministically from customer `state_code` vs company `state_code` (Tamil Nadu = 33).
  - Intra-State (State 33 $\to$ State 33): $\text{CGST} = \text{SGST} = \text{round\_paise}(\text{taxable} \times 2.5\%)$
  - Inter-State (State 33 $\to$ State 29): $\text{IGST} = \text{round\_paise}(\text{taxable} \times 5.0\%)$
- **Gap-Free Invoicing:** Invoice numbers (e.g. `BTL/2026-27/0001`) use row-locked financial year counters (`invoice_counters`), with canceled numbers retired via Credit Notes (`CN/...`).

---

## 6. Authentication & Deterministic Intelligence Layer
- **Auth Flow:** Firebase Authentication acts as the IDP. The FastAPI backend verifies the token and retrieves the user's role from PostgreSQL. For automated tests and standalone offline execution, a secure development auth adapter provides identical role verification.
- **Production Decision Engine:** When demand exceeds unreserved stock, deterministic calculations compute batch count $\lceil \text{target} / \bar{Y} \rceil$, BOM bill of materials requirements, ingredient shortfall, and total production cost without executing runs automatically.
- **Batch Genealogy & Recall Simulator:** Recursive SQL CTEs traverse the graph bi-directionally:
$$\text{Supplier Lot} \leftrightarrow \text{Run Consumption} \leftrightarrow \text{Production Run} \leftrightarrow \text{FG Batch} \leftrightarrow \text{Dispatch} \leftrightarrow \text{Invoice} \leftrightarrow \text{Customer}$$
- **Statistical Anomaly Detection:** Rules R1–R7 trigger deterministic alerts with strict sample size guards ($n \ge 3$ or $n \ge 5$), attributing correlation without unsubstantiated causal claims.
- **What-If Simulator:** A pure read-only projection function asserting zero ledger side-effects.
