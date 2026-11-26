# BATCHLY — Technical Design Note

**Project:** Order-to-Audit System for a Small Food Manufacturer  
**Repository:** https://github.com/giti-27/Batchly  
**Live prototype:** https://batchly-pi.vercel.app

## 1. System overview

Batchly connects two operational flows:

- **Sales:** salesman order → admin review → stock check/approval → GST invoice → dispatch → payment recording.
- **Production:** purchase receipt → BOM-based material issue → production completion → finished-goods receipt → variance and cost calculation.

The frontend is a React/TypeScript application. A FastAPI backend exposes the business operations and uses SQLAlchemy for database access. PostgreSQL is used for the hosted deployment; SQLite is used by the automated in-memory tests.

## 2. Main data model

The principal entities and relationships are:

```text
Customer ──< Order ──< OrderLine
   │           │
   │           └──── Invoice ──< InvoiceLine
   │                         └── Dispatch ──< DispatchLine
   └──< Payment ──< PaymentAllocation

Item ──< Batch
 │         │
 │         └── ProductionRun (finished-goods batch)
 │
 └──< StockLedger

Product ──< BOM ──< BOMLine ──> Item
   │
   └──< ProductionRun ──< RunConsumption
                       └──< RunOverhead

Supplier ──< Purchase ──< PurchaseLine ──> Item
```

The model separates customers, orders, invoices, dispatches, payments, products, BOMs, production runs, batches, purchases, and stock movements. This supports traceability between commercial transactions and inventory changes.

## 3. Inventory ledger and stock updates

Inventory changes are represented as signed stock-ledger movements. Receipts increase stock; issues, scrap, and dispatch reduce stock; production completion adds finished goods.

The operational stock balance is reconciled against the sum of ledger movements. The reconciliation check is intended to detect drift:

\[
\text{Expected balance} = \sum \text{stock ledger quantity deltas}
\]

The application initializes database protections for posted ledger rows and maintains balance records for operational reads. The benchmark verifies that the final reconciliation reports zero drift.

## 4. BOM, production variance, and costing

The benchmark BOM for one standard batch of Murukku 200 g uses:

| Material | Planned quantity |
|---|---:|
| Flour | 40 kg |
| Oil | 10 L |
| Spice mix | 1.2 kg |
| Pouches | 1 per good packet |
| Cartons | 1 per 20 packets (benchmark completion records 9 cartons) |

The benchmark run records actual issue/consumption, good output, and damaged packaging. Variance is calculated against planned quantities. A variance outside the configured tolerance is flagged; the benchmark uses a 3% threshold, with strict greater-than comparison for the tested material variance rule.

The benchmark costing combines actual material consumption at the applicable cost snapshots and run overheads:

\[
\text{Cost per good packet} =
\frac{\text{Material cost}+\text{Run overheads}}
{\text{Actual good packets}}
\]

For the benchmark, overheads are ₹1,200 labour and ₹600 gas/power. The automated test checks total run cost of ₹5,855 and cost per good packet of approximately ₹31.14.

## 5. Purchase valuation

The benchmark demonstrates moving weighted-average valuation for flour. Opening stock is 100 kg at ₹42/kg; the purchase adds 60 kg at ₹45/kg.

\[
\text{New average} =
\frac{(100 \times 42)+(60 \times 45)}{100+60}
= ₹43.125/\text{kg}
\]

The test checks the resulting 160 kg balance and weighted-average rate before production consumes 40 kg.

## 6. Sales, GST, and receivables

The benchmark order for Retailer A is 150 packets at ₹50 each. The taxable value is ₹7,500. Since both the factory and Retailer A are in Tamil Nadu, the invoice applies 2.5% CGST and 2.5% SGST:

- CGST: ₹187.50
- SGST: ₹187.50
- Invoice total: ₹7,875.00

The 150-packet dispatch reduces finished goods from 238 to 88 packets. Distributor B's 120-packet order therefore has a shortage of 32 packets. A ₹4,000 payment from Retailer A leaves ₹3,875 outstanding.

## 7. Authentication and access control

The active login implementation verifies passwords using bcrypt and issues JWT bearer tokens. Protected API routes resolve the authenticated user and check the user's role before allowing access. Firebase-related settings are retained for compatibility but are not the active identity-provider flow.

The seeded demo roles are Admin, Salesman, Production, Auditor, and Owner. The Auditor workspace/API access is intended to be read-only and should be demonstrated as such.

## 8. Verification

The repository includes automated backend tests, including a benchmark-flow test that asserts the core quantities, invoice tax values, stock shortage, payment outstanding, costing, and zero-drift reconciliation.

Run from the repository root:

```powershell
python -m pytest api\tests -q
```

The design note describes the current prototype implementation. It does not claim integrations with government GST systems, payment gateways, or external accounting platforms.
