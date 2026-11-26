# BATCHLY
## Order-to-Audit System for a Small Food Manufacturer

**Live application:** https://batchly-pi.vercel.app/login  
**Source repository:** https://github.com/giti-27/Batchly  
**API health endpoint:** https://batchly-pi.vercel.app/api/health

Batchly is a web-based prototype that connects order entry, order approval, production, inventory movements, GST billing, dispatch, payment recording, and operational reporting for a small food manufacturer.

> This project uses synthetic demonstration data only. The company, customers, GSTINs, addresses, and transactions in the benchmark are sample data and must not be treated as real business records.

---

## 1. Problem addressed

Small food manufacturers often maintain sales, purchasing, production, inventory, and collections in separate registers. Batchly demonstrates a connected workflow in which production and sales transactions update stock and financial records, while role-based workspaces provide different views for sales, administration, production, auditing, and ownership.

The prototype is built around the benchmark scenario in **Section 5** of the supplied problem statement.

## 2. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React, TypeScript, Vite | Browser-based role workspaces |
| Backend | Python, FastAPI, Pydantic | REST API and business workflows |
| ORM / persistence | SQLAlchemy | Database models and transactions |
| Database | PostgreSQL for deployment; SQLite supported for local tests | Persistent application data |
| Authentication | Backend password verification with bcrypt and JWT | Login and role-based API authorization |
| Deployment | Vercel | Hosted frontend and API services |

Firebase-related configuration/dependencies may remain in the codebase for compatibility, but **the current login flow is backend-managed bcrypt password verification followed by JWT authentication**. Firebase Authentication is not the active authentication provider.

## 3. Implemented workflows

### Sales and dispatch
- Salesman order entry against assigned customers.
- Admin review and order approval/hold/rejection.
- Stock availability checks before fulfilment.
- GST invoice generation with intra-state CGST/SGST and inter-state tax handling.
- Dispatch and finished-goods stock deduction.
- Payment recording and customer outstanding calculation.

### Purchasing, production, and inventory
- Supplier purchase posting and raw-material stock receipt.
- BOM-based production planning and material issue.
- Production completion with good output and packaging consumption/damage.
- Stock movements recorded through the stock ledger.
- Production yield and material-consumption variance calculation.
- Run-level material and overhead costing.
- Stock balance reconciliation.

### Roles
The seeded demonstration data contains these accounts:

| Username | Role | Demonstration password |
|---|---|---|
| `admin` | Admin | `demo123` |
| `salesman_a` | Salesman | `demo123` |
| `salesman_b` | Salesman | `demo123` |
| `production` | Production | `demo123` |
| `auditor` | Auditor | `demo123` |
| `owner` | Owner | `demo123` |

These are public evaluation credentials for a synthetic demo dataset. Do not reuse them for real users or production accounts. The Auditor role is intended to be read-only; verify this during the recorded walkthrough.

## 4. Benchmark scenario (Problem Statement Section 5)

The benchmark seed and automated test exercise the following scenario:

1. Purchase 60 kg of flour at ₹45/kg.
2. Issue 40 kg flour, 10.5 L oil, and 1.2 kg spice mix to a production run.
3. Complete the run with 188 good packets, 6 damaged pouches, and 9 cartons.
4. Create a 150-packet order for Retailer A (Tamil Nadu).
5. Approve the order, generate the GST invoice, and dispatch it.
6. Create a 120-packet order for Distributor B (Karnataka) and demonstrate the stock shortage.
7. Record a ₹4,000 payment from Retailer A.
8. Include ₹1,200 labour and ₹600 gas/power overheads in the production run costing.
9. Review available reports and verify stock-ledger reconciliation.

### Expected benchmark values

| Check | Expected result |
|---|---:|
| Flour after purchase | 160 kg |
| Flour moving weighted-average cost | ₹43.125/kg |
| Flour after production issue | 120 kg |
| Oil after production issue | 19.5 L |
| Spice mix after production issue | 3.8 kg |
| Pouches after use and damage | 306 |
| Cartons after production | 21 |
| Finished goods after production | 238 packets |
| Yield variance | -6% |
| Oil consumption variance | +5% |
| Retailer A taxable value | ₹7,500.00 |
| Retailer A CGST | ₹187.50 |
| Retailer A SGST | ₹187.50 |
| Retailer A invoice total | ₹7,875.00 |
| Finished goods after dispatch | 88 packets |
| Distributor B shortage | 32 packets |
| Retailer A outstanding after payment | ₹3,875.00 |
| Production run total cost | ₹5,855.00 |
| Production cost per good packet | Approximately ₹31.14 |
| Final stock reconciliation | Zero drift / healthy |

The benchmark values above are verified by the automated benchmark test and benchmark seed implementation. They are not a claim that the currently hosted database has been reset to this state. The live demonstration should be performed against a prepared demo dataset and the displayed values should be checked before recording.

## 5. Reports and exports

The current backend exposes the following report functionality:

| Report / endpoint | Current output |
|---|---|
| Sales register | JSON or CSV |
| GST summary | JSON |
| GSTR-1-style outward-supply summary | JSON |
| GSTR-3B-style outward-supply summary | JSON |
| Stock summary | JSON or CSV |
| Production report | JSON or CSV |
| Audit log | JSON |

CSV export is implemented for the sales register, stock summary, and production report. CSV cells are sanitized against common spreadsheet formula-injection prefixes.

**Known reporting limitations:** A dedicated purchase-register report, stock-ledger export, payment/collections and receivables-ageing report export, and monthly-report PDF/Excel export are not currently exposed by the inspected report router. Do not present these as completed features in the demo. The application may contain related transaction screens or APIs, but those are not equivalent to the missing report exports.

## 6. Feature scope against the problem statement

| Scope tier | Current implementation summary |
|---|---|
| Must-have | Role-based workflow; masters and BOM-backed production; order entry and admin approval; GST invoicing; production stock updates; variance calculation; stock summary; sales register and stock-summary CSV |
| Should-have | Supplier purchase posting; payment recording and outstanding calculation; run overhead costing; GST summary; production report; owner/auditor workspaces |
| Stretch / partial | Batch/FEFO-oriented stock handling and additional intelligence features are present in parts of the application. Offline order sync, GPS visit tracking, government e-invoice/e-waybill integration, and Tally integration are not claimed as complete. |

This table is intentionally conservative. It distinguishes implemented prototype functionality from integrations or report exports that are not present.

## 7. Architecture and data integrity

- FastAPI exposes the application API.
- SQLAlchemy maps the application entities to the configured database.
- Inventory movements are represented through stock-ledger entries.
- Stock-balance records are maintained for operational reads and checked against ledger movements through reconciliation.
- Monetary calculations use integer paise and decimal arithmetic in the backend.
- Passwords are stored as bcrypt hashes; authenticated API requests use JWT bearer tokens.
- Role checks are applied to protected API routes.

See [`docs/design-note.md`](docs/design-note.md) for the concise technical design note and data-flow overview.

## 8. Run locally

### Prerequisites
- Python 3.12 or 3.13
- Node.js 20 or newer
- npm

### Backend

Run these commands from the repository root in PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r api\requirements-dev.txt
Copy-Item .env.example .env
```

Edit `.env` and set a unique local `SECRET_KEY`. Keep `.env` private; it must not be committed.

For a **fresh local database only**, seed the benchmark:

```powershell
python api\seed\seed_benchmark.py --reset --run
```

The `--reset` option drops and recreates database tables. Never run it against a shared, hosted, or production database. Use a disposable local database.

Optional historical demonstration data:

```powershell
python api\seed\seed_demo_history.py
```

Run backend tests:

```powershell
python -m pytest api\tests -q
```

Start the API from the repository root:

```powershell
uvicorn api.app.main:app --reload --port 8000
```

API documentation: http://127.0.0.1:8000/docs

### Frontend

Open a second PowerShell terminal:

```powershell
cd web
npm install
npm run build
npm run dev
```

Vite prints the local frontend URL, normally http://localhost:5173.

`npm install` is used here because the repository instructions should not assume a committed lockfile is available. If a `package-lock.json` is added and committed, use `npm ci` for reproducible installs.

## 9. Deployment

The public prototype is deployed at:

- Frontend: https://batchly-pi.vercel.app
- Login: https://batchly-pi.vercel.app/login
- API health: https://batchly-pi.vercel.app/api/health

Deployment requires environment variables to be configured in the hosting provider. Do not put database credentials, JWT secrets, or private keys in source control.

The public demo credentials are listed in Section 3. They are intended only for the synthetic evaluation dataset.

## 10. Tests

Run the backend test suite from the repository root:

```powershell
python -m pytest api\tests -q
```

Build the frontend:

```powershell
cd web
npm install
npm run build
```

Record the actual test output and build result at submission time. Do not copy an old test log and describe it as a fresh run.

## 11. Known limitations and assumptions

- This is an internship evaluation prototype, not a certified accounting, GST filing, or ERP product.
- GST outputs are demonstrative and do not submit returns to government systems.
- No live GST e-invoice/e-waybill, payment gateway, or Tally integration is claimed.
- The current reports router does not expose every report/export listed as a desired capability in the problem statement; see Section 5.
- Offline order synchronization should be treated as unverified/not delivered unless it is separately tested end-to-end.
- The seeded users, customer records, supplier, GSTINs, and transaction history are synthetic.
- The benchmark seed script's `--reset` flag is destructive and must only be used with a disposable local database.

## 12. Submission deliverables

1. **Public source repository:** this repository, including application source, tests, seed scripts, deployment configuration, README, and design note.
2. **Design note:** [`docs/design-note.md`](docs/design-note.md).
3. **Live application:** https://batchly-pi.vercel.app/login
4. **Demo video:** Add the unlisted YouTube or Drive link here after recording. Keep the video within the 8-minute limit and follow the Section 5 benchmark sequence.
5. **Test evidence:** Include the fresh backend test and frontend build results in the submission message or accompanying evidence.

**Demo video link:** _Add after uploading the final recording._
