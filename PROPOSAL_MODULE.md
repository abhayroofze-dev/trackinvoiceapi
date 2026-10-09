# Proposal module - setup

## 1. Backend (invoice-backend)
```
npm install                  # REQUIRED once: adds sanitize-html
npm run dev                  # proposal tables + 5 Terms templates are created automatically on start
```
(`npm run migrate:proposals` still works if you prefer to run it by hand.)

Check it worked: open http://localhost:5000/api/health  ->  "proposals":"ready"
If you forget `npm install`, invoices keep working and /api/proposals tells you exactly what to run.
Tables: proposal_sequences, terms_master, proposals, proposal_sections,
proposal_section_contents, proposal_section_tables, proposal_table_columns,
proposal_table_rows, proposal_table_cells, proposal_section_terms.

API: /api/proposals (list, next-number, get, create, PUT save, POST :id/finalize,
PATCH :id/status, delete) and /api/terms-master (generic CRUD).

## 2. Frontend (invoice-frontend)
```
npm install
npm run dev
```
Sidebar: "Create Proposal" and "All Proposals".
Company details on the PDF (cover + last page): src/data/company.js

## 3. PDF
"Download PDF" opens the browser print dialog -> choose "Save as PDF".
In Chrome keep "Background graphics" ON; "Headers and footers" can stay off.

## New files
backend:  scripts/migrate-proposals.js, controllers/proposalController.js,
          routes/proposalRoutes.js, utils/proposalHtml.js
frontend: api/proposals.js, data/company.js, pages/proposals/*,
          components/proposal/*, public/proposal-*.{png,jpg}
## Edited files
backend:  routes/index.js, server.js (25mb JSON limit), package.json
frontend: App.jsx, components/layout/Sidebar.jsx, index.html (Montserrat font)

## Troubleshooting ("backend not working")
Run this inside invoice-backend - it tells you exactly what is missing:
```
npm install
npm run check:proposals
```
| Symptom | Fix |
|---|---|
| `Cannot find module 'sanitize-html'` / proposal routes return 503 | `npm install`, restart server |
| "Proposal tables are missing" | restart the server (creates tables automatically) or `npm run migrate:proposals` |
| Browser shows "Failed to fetch" | backend not running, or frontend URL != backend PORT. Frontend uses `VITE_API_BASE_URL` (default http://localhost:5000/api) - make `.env` PORT match |
| Client dropdown empty | add an active client in the Clients page |
| Terms dropdown empty | `npm run migrate:proposals` (seeds 5 templates) |
| Save fails with "Data too long"/packet error for images | restart server (JSON limit is 25mb in server.js); also check MySQL `max_allowed_packet` >= 32M |
Health check: http://localhost:5000/api/health  ->  `"proposals":"ready"`
