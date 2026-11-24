# BATCHLY — Intelligent Order-to-Audit Manufacturing Operations Platform

> **Tagline:** *From Salesman's Order to Auditor's Report.*  
> **Prepared for:** Gitika · NIT Trichy CDI Winter Internship 2026 · Product Requirements Document v1.0

---

## 1. Product Overview & Problem Statement
Small-to-medium Indian snack manufacturers struggle with disjointed paper/notebook records, manual invoice re-typing, unmonitored raw material wastage, and labor-intensive month-end GST and cost reconciliation.

**BATCHLY** bridges the **Sales Loop** (salesman order entry, admin credit verification, GST invoice generation, FEFO dispatch, collection allocation) and the **Production Loop** (material purchasing, BOM material issue, production execution, scrap accounting, moving weighted-average costing, and deterministic yield intelligence) with a single, tamper-evident, append-only stock ledger.

---

## 2. Architecture & Technology Justification

```
  +-------------------------------------------------------------+
  |              BATCHLY FRONTEND (PWA, React, Vite)            |
  |    Salesman (Mobile) · Admin · Production (Tablet) · Auditor · Owner  |
  +-------------------------------------------------------------+
                                | REST JSON / Bearer JWT
                                v
  +-------------------------------------------------------------+
  |               FASTAPI BACKEND (Python 3.12 / 3.13)          |
  |  Thin Routers -> Service Layer -> Deterministic Engine      |
  |  - ledger_service: Append-only, Trigger Enforced, Zero Drift|
  |  - production_service: Dynamic BOM, FEFO, Costing           |
  |  - sales_service: GST Intra/Inter, Gap-Free Invoicing       |
  |  - intelligence_service: Decision Engine, Recall, What-if   |
  +-------------------------------------------------------------+
                                | SQLAlchemy 2 (Row Locking)
                                v
  +-------------------------------------------------------------+
  |                   POSTGRESQL 16 DATABASE                    |
  |  - stock_ledger: Append-Only Immutable Master               |
  |  - stock_balance & batch_balance: Locking Caches (CHECK >=0)|
  |  - invoice_counters: Row-Locked Gap-Free Sequence           |
  +-------------------------------------------------------------+
```

### Technology Stack Justification
- **FastAPI (Python 3.12+) & Pydantic v2:** Automatic typed OpenAPI validation, native `Decimal` precision support without floating-point leaks.
- **SQLAlchemy 2 & PostgreSQL 16:** Real ACID transactions, deterministic pessimistic row locks (`SELECT ... FOR UPDATE`), `CHECK (qty >= 0)` constraints, and recursive CTEs for batch genealogy.
- **Append-Only Stock Ledger (`stock_ledger`):** Stock is never overwritten. $\text{Balance} = \sum \Delta \text{qty}$. Database triggers unconditionally block `UPDATE` and `DELETE` on posted rows.
- **React, Vite, Tailwind CSS & Framer Motion:** Installable Progressive Web App (PWA) with bespoke dark editorial SaaS visual styling, strictly adhering to **Cinzel** (headings) and **Fauna One** (body text).
- **Firebase Authentication (Project: `limitless-c72be`):** Identity provider integration coupled with backend role authorization stored in PostgreSQL.

---

## 3. Strict Design System & Typography

### Typography Rule
- **Heading Font:** `Cinzel` (Page headers, major titles, KPI numbers).
- **Body Font:** `Fauna One` (Forms, tables, descriptions, navigation, buttons).
- *Strictly no Inter, Roboto, Poppins, or unapproved fonts.*

### Exact Color Palette
| Color Name | Hex Code | Purpose |
|---|---|---|
| **Deep Black** | `#080808` | Primary surface background |
| **Charcoal** | `#39333B` | Secondary panels and table cards |
| **Electric Violet** | `#8050ED` | Primary interactive buttons, badges, glows |
| **Warm Gold** | `#E7CA65` | Financial totals, currency highlights, KPI accents |
| **Sage** | `#BFCFC1` | Secondary light accents |
| **Muted Mauve** | `#887984` | Metadata, timestamps, captions |
| **Off-white** | `#F5F4EF` | Primary readable text |

---

## 4. Five Role-Specific Workspaces

1. **Salesman Workspace (`/salesman`):** Mobile-first design with bottom navigation. Access to assigned customers only. Product quantities in whole packet increments, quick-add carton button (`+20` packets), instant price snapshot from price list, order review with live GST preview, idempotent order creation via client UUID.
2. **Admin Workspace (`/admin`):** Order inbox with age and shortage badges, stock availability check, one-click order approval (with stock reservation), hold, or reject. Gap-free GST invoice creation (`BTL/YYYY-YY/0001`), FEFO dispatch execution, payment allocation, and customer outstanding calculation.
3. **Production Workspace (`/production`):** Tablet-optimized touch targets. Planned run creation with batch multiplier, BOM material availability check, FEFO raw material issue, production run completion with scrap absorption, variance analysis (`abs(variance) > 3.00%` strict flagging), and run costing.
4. **Auditor Workspace (`/auditor`):** Strictly read-only badge. Statutory Sales Register, Purchase Register, Stock Summary with mathematical balance check ($\text{Opening} + \text{In} - \text{Out} \pm \text{Adj} - \text{Closing} \equiv 0$), Stock Ledger, GSTR-1 & GSTR-3B 3.1(a) reports, Batch Recall Simulator (forward & backward trace), batch quarantine, and SHA-256 hash-chain integrity verification.
5. **Owner Workspace (`/owner`):** Executive overview with gross margin %, finished goods days of cover, variance alerts, top 3 operational insights, and interactive **What-If Simulator** ("SIMULATION — NO BUSINESS RECORDS CHANGED").

---

## 5. Seed Demo Accounts

All demo accounts use the standard password: `demo123`

| Username | Role | Primary Workspace |
|---|---|---|
| `admin` | `ADMIN` | `/admin` |
| `salesman_a` | `SALESMAN` | `/salesman` (Assigned: Retailer A, TN) |
| `salesman_b` | `SALESMAN` | `/salesman` (Assigned: Distributor B, KA) |
| `production` | `PRODUCTION` | `/production` |
| `auditor` | `AUDITOR` | `/auditor` (Strictly Read-Only) |
| `owner` | `OWNER` | `/owner` (Executive Intelligence) |

---

## 6. PRD Section 11 Benchmark Specification (Gate 1: 100% PASSED)

| Step | Action | PRD Expected Value | Batchly Live Database Value | Status |
|---|---|---|---|:---:|
| **1** | Purchase 60 kg flour @ ₹45/kg | Flour: 160 kg; Wtd Avg: ₹43.125/kg | Flour: 160.000 kg; Wtd Avg: ₹43.125/kg | **PASS** |
| **2** | Production Issue (Flour 40kg, Oil 10.5L, Spice 1.2kg) | Flour: 120kg; Oil: 19.5L; Spice: 3.8kg; Oil +5% flagged | Flour: 120.000kg; Oil: 19.500L; Spice: 3.800kg; Oil +5.00% flagged | **PASS** |
| **3** | Complete Run (188 good pkts, 6 damaged pouches, 9 cartons) | Pouches: 306 (-3% unflagged); Cartons: 21 (-10% flagged); Yield: -6% flagged; FG: 238 pkts; Cost/pkt: ₹31.14 | Pouches: 306 (-3.00% unflagged); Cartons: 21 (-10.00% flagged); Yield: -6.00% flagged; FG: 238 pkts; Cost/pkt: ₹31.14 | **PASS** |
| **4-5** | Salesman A Order 150 pkts for Retailer A; Approve, Invoice, Dispatch | Invoice: Taxable ₹7,500 + CGST ₹187.50 + SGST ₹187.50 = ₹7,875.00. FEFO: 50 opening + 100 run batch. FG remaining: 88 pkts | Invoice `BTL/2026-27/0001`: Taxable ₹7,500.00, CGST ₹187.50, SGST ₹187.50, Total ₹7,875.00. FEFO: 50 from opening batch + 100 from run batch. FG remaining: 88 pkts | **PASS** |
| **6** | Salesman B Order 120 pkts for Distributor B | Available: 88, Shortage: 32; Decision Engine recommends 1 batch; Admin holds order | Shortage: 32 pkts detected; Decision Engine recommends 1 batch (materials sufficient); Admin holds order | **PASS** |
| **7** | Payment ₹4,000 from Retailer A | Allocated to 0001; Outstanding: ₹3,875.00; Ageing: 0-30 days | Allocated to 0001; Outstanding: ₹3,875.00; Ageing: 0-30 days | **PASS** |
| **8** | Overheads: Labour ₹1,200 + Gas/Power ₹600 | Total Run Cost: ₹5,855.00; Cost/pkt: ₹31.1436 (₹31.14); Margin: ₹18.86 (37.7%) | Total Cost: ₹5,855.00; Cost/pkt: ₹31.14; Margin: ₹18.86 (37.7%) | **PASS** |
| **9** | Reports & Final Ledger Reconciliation | Reconciliation drift == 0; zero_drift == True | Reconciliation status: HEALTHY; Total drift: 0; zero_drift: True | **PASS** |

---

## 7. Costing Methodology & Decoupling Rule

1. **Perpetual Moving Weighted Average:**
   $$\bar{C}_{\text{new}} = \frac{Q_{\text{current}} \cdot \bar{C}_{\text{current}} + Q_{\text{new}} \cdot C_{\text{purchase}}}{Q_{\text{current}} + Q_{\text{new}}}$$
2. **Decoupling Rule:** Batches are strictly used for physical tracking, expiry management, and FEFO allocation. Batches are **never** used for inventory valuation. This eliminates batch-vs-average accounting drift.
3. **Packaging Scrap Absorption:** Damaged packaging units are absorbed into the cost of good output packets.
4. **Overhead Allocation:** 100% of run labor and power overheads are allocated to that run's good output:
   $$\text{Cost Per Packet} = \frac{\sum (\text{Actual Consumed Quantity} \times \text{Snapshot Unit Cost}) + \text{Run Overheads}}{\text{Actual Good Packets Produced}}$$

---

## 8. Local Setup & Execution Guide

### Prerequisites
- Python 3.12 or 3.13
- Node.js 20+ and npm
- Docker (optional for containerized single-command execution)

### 1. Backend Setup
```bash
# Install Python dependencies
pip install -r api/requirements.txt

# Reset and seed benchmark dataset with steps 1 to 9 executed
python api/seed/seed_benchmark.py --reset --run

# Seed historical production runs for anomaly rules R2-R7
python api/seed/seed_demo_history.py

# Run all automated tests
pytest api/tests/ -v

# Start FastAPI server
uvicorn api.app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd web
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

### 3. Docker Compose (Single-Command Run)
```bash
docker compose up --build
```
- API & Swagger: `http://localhost:8000/docs`
- Web Application: `http://localhost:5173`

---

## 9. Feature Tiers & Scope Declarations

### P0 (Must Have — Fully Implemented & Tested)
- Append-only stock ledger with database mutation prevention trigger (Invariant I1).
- Non-negative stock constraints (`CHECK (qty >= 0)`) and zero-drift cache reconciliation (Invariant I2, I3).
- Strict integer paise financials (`BIGINT`) with Decimal `ROUND_HALF_UP` (Invariants I4, I6).
- Normalized base units (`g`, `ml`, `pcs`, `packet`) with boundary UOM conversions (Invariant I5).
- Production lifecycle (`PLANNED -> IN_PROGRESS -> COMPLETED`) with strict tolerance variance flags (`abs(variance) > 3.00%`).
- Dynamic BOM architecture supporting product pack size variants (e.g. 200g vs 500g).
- Sales order booking with client-generated UUID idempotency (Invariant I10).
- Admin verification, stock reservation, and row-locked gap-free GST invoicing (`BTL/YYYY-YY/0001`).
- FEFO dispatch allocation and payment collection with receivables ageing.
- Full Section 11 benchmark passing 100% via automated tests and interactive `/benchmark` page.

### P1 (Should Have — Fully Implemented)
- Batch genealogy recursive CTEs (`v_batch_genealogy`).
- Forward & backward batch recall simulator with quarantine capabilities.
- Production Decision Engine calculating batches needed, BOM ingredient shortfalls, and production cost.
- Anomaly detection rules R1–R7 with strict sample size guards ($n \ge 3$, $n \ge 5$).
- Owner executive intelligence dashboard.
- Statutory reports with CSV export escaping formula injections (`=`, `+`, `-`, `@`).

### P2 (Differentiators — Implemented)
- Tamper-evident cryptographic SHA-256 hash chaining on stock ledger and audit logs (`/audit/integrity`).
- What-If simulator pure read-only projection function with 4 instant presets.
- Public QR batch traceability certificate (`/t/{batch_no}`).
- Installable Progressive Web App (PWA) manifest.

### Known Gaps (Declared Out of Scope per PRD Section 0)
- Real government GST e-way bill / e-invoice API credentials (dummy GSTIN format used for benchmark).
- Real payment gateway API integration (direct payment recording with allocation implemented).
- Multi-warehouse and multi-company inventory transfers.
- Supplier purchase returns and supplier scorecards.
