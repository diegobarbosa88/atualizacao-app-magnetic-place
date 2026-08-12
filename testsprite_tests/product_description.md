# Product Description — Magnetic Place | Gestão

**Version:** refatoracao-v2 (ef2ccb0)  
**Date:** 2026-06-12  
**Type:** Internal Operations Platform (Web App)  
**Stack:** React 18 + Vite, Tailwind CSS, Supabase, Vercel Serverless API

---

## Product Overview

Internal finance and operations platform for **Magnetic Place Unipessoal Lda**. Centralises worker time tracking, salary management, bank reconciliation, document management, client billing via TOConline, and expense control. Accessed by admins (full access) and workers (limited dashboard).

---

## User Roles

| Role | Access |
|---|---|
| **Admin** (`admin`) | Full access to all tabs and features |
| **Worker** | Personal dashboard: clock-in/out, correction requests, documents |
| **Client** | External portal for timesheet approvals (separate URL) |

---

## Authentication

- Login page at `/` with username + password
- Admin password stored in Supabase auth
- Redirect to admin dashboard on admin login, worker dashboard on worker login
- Session persisted via Supabase session

---

## Admin Features

### 1. Overview (Geral)
- KPI cards: hours worked, active workers, pending corrections, open expenses
- Financial summary panel with revenue vs costs
- Quick access to pending approvals

### 2. Entradas (Time Logs)
- Select worker + month to view daily time entries
- See clock-in / clock-out times per day
- View pending, approved and rejected corrections inline
- Approve or reject correction requests with optional comment
- Filter by worker, month, status

### 3. Salários (Salaries)

#### 3a. Salary Management
- View expected vs actual salary per worker per month
- Workers shown as cards with divergence indicator (positive/negative sign)
- Add justifications for salary differences (modal with text input)
- View full salary history per worker
- Salary deductions (descontos): persistent per worker/month stored in `worker_salary_deductions` table
- Import IBANs from novobanco beneficiary list (CSV upload modal)

#### 3b. SEPA XML Export (Standard)
- Button "SEPA XML" opens export modal
- Only shows workers with `expected_amount > 0` for selected month AND with IBAN registered
- Checkbox list: select individual workers or "Seleccionar todos"
- Per-worker amount adjustment: adicionar (add) / abater (subtract) fields
- Click "Exportar" → POST to `/api/salarios/exportar-sepa` → downloads `salarios_magnetic_place.xml`
- XML format: SEPA pain.001.001.03, debtor = Magnetic Place, category purpose = SALA
- Requires env vars: `MINHA_CONTA_IBAN`, `MINHA_CONTA_BIC`

#### 3c. Transferência Imediata / SCT Inst
- Button "Transf. Imediata" opens same modal in instant mode
- XML includes `<LclInstrm><Cd>INST</Cd>` flag
- Uses today's date as execution date (not T+2 business days)
- Downloads as `transferencias_imediatas_magnetic_place.xml`

#### 3d. Reconciliação Salarial
- Upload bank statement CSV (novobanco format)
- Auto-match transactions to workers by name/amount
- View matched and unmatched transactions
- Manually associate unmatched transactions to workers
- Confirm reconciliation state per month

### 4. Faturas (Invoices)
- Import invoices from Gmail (PDF attachments via Google API)
- Parse invoice data with AI (Google Generative AI)
- List of invoices with supplier, amount, date, status
- Link invoices to bank transactions (movimentações)
- Create invoices in TOConline system
- TOConline panel with clients, articles, documents

### 5. Movimentações (Bank Transactions)
- Upload bank statement CSV
- View transactions with auto-categorisation
- Tag transactions (fatura, imposto, interno, nota de crédito)
- Link payment URLs to transactions
- Auto-match engine for reconciliation
- Export tools for accounting

### 6. Equipa (Team / Workers)
- Worker list with active/inactive status
- Add/edit worker profile (name, hourly rate, IBAN, employment dates)
- Employment history modal per worker
- Hourly rate change history
- Absence request management (pending/approved/rejected)
- Change request management
- Worker validation panel with document status

### 7. Documentos (Documents)
- Document list with filters (worker, type, status, date)
- Upload documents (PDF, DOCX, images)
- Preview documents in-app (PDF viewer, DOCX preview)
- Request digital signature from worker
- Admin can draw/sign documents
- Validation stamps (classic, corporate, with QR code)
- Document templates management

### 8. Relatórios (Reports)
- Cost reports by client/project
- Ajudas de custo calculator
- Financial report overlay
- Client timesheet reports (PDF export)
- Export to CSV/DOCX

### 9. Clientes (Clients)
- Client list with contact info
- Client portal notification settings
- Send timesheets to client for approval
- Client approval workflow

### 10. Configurações (Settings)
- Company settings (logo, stamp, signature)
- Email configuration (EmailJS)
- Notification preferences per worker
- TOConline API configuration
- Theme and display settings

---

## Worker Dashboard Features

- Clock-in / clock-out with precise timestamps
- View monthly time summary
- Submit correction requests (wrong time entry)
- View correction status (pending/approved/rejected)
- Access personal documents
- Sign documents digitally

---

## Client Portal

- External URL: `painelcliente.magneticplace.pt`
- View timesheet reports submitted by admin
- Approve or reject with comment
- No login required (token-based access)

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/salarios/exportar-sepa` | Generate SEPA XML (standard or instant) |
| POST | `/api/parse-fatura` | Parse invoice PDF with AI |
| POST | `/api/reconciliacao/upload` | Upload bank statement for reconciliation |
| POST | `/api/reconciliacao/process` | Process reconciliation |
| GET/POST | `/api/toconline/clientes` | TOConline clients |
| GET/POST | `/api/toconline/artigos` | TOConline articles |
| POST | `/api/toconline/create-fatura` | Create invoice in TOConline |
| GET | `/api/toconline/relatorio` | TOConline reports |
| POST | `/api/gmail/import-faturas` | Import invoices from Gmail |

---

## Key User Flows

### Flow 1 — Export Monthly Salaries via SEPA
1. Admin logs in → navigates to "Salários" tab
2. Selects month (e.g. Junho 2026)
3. Reviews worker cards — sees expected vs actual amounts
4. Clicks "SEPA XML" button
5. Modal opens with list of eligible workers (have IBAN + salary > 0)
6. Adjusts amounts if needed (add/subtract per worker)
7. Clicks "Exportar"
8. XML file downloads automatically

### Flow 2 — Immediate Transfer (SCT Inst)
1. Same as Flow 1 but clicks "Transf. Imediata"
2. Modal opens in instant mode
3. XML includes INST flag, uses today's date

### Flow 3 — Approve Worker Correction
1. Admin goes to "Entradas" tab
2. Selects worker + month
3. Sees correction marked as pending
4. Clicks approve/reject with optional comment
5. Worker sees updated status on their dashboard

### Flow 4 — Import and Reconcile Invoices
1. Admin goes to "Faturas" → clicks import from Gmail
2. PDF invoices parsed automatically
3. Admin links invoices to bank movements
4. Creates invoice in TOConline if needed

### Flow 5 — Worker Signs Document
1. Admin uploads document to worker
2. Worker sees notification on dashboard
3. Worker opens document, signs digitally
4. Admin sees signature stamp applied

---

## Known Limitations

- SEPA export requires `MINHA_CONTA_IBAN` and `MINHA_CONTA_BIC` env vars
- SEPA modal only shows workers with salary > 0 for selected month
- TOConline integration requires active API credentials
- Gmail import requires OAuth2 setup
- File uploads limited by Vercel serverless 4.5MB body limit
