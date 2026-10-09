# Roofze Invoice Backend (Node.js + Express + MySQL)

REST API for your `rfzbilling_` MySQL Workbench database. Connects to your
existing tables (`billing_location`, `clients`, `financial_year`,
`tax_master`) and exposes full CRUD (Create, Read, Update, Delete) for each.

**Fields are never hardcoded.** Every route reads the real column list from
MySQL's `INFORMATION_SCHEMA` at request time (`utils/schemaUtils.js`), so
whatever columns exist in Workbench are exactly what the API accepts and
returns. Add a column in Workbench → it just shows up in the API.

## 1. Install

```bash
cd invoice-backend
npm install
```

## 2. Configure your database connection

```bash
cp .env.example .env
```

Edit `.env` and put in your actual MySQL Workbench credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=rfzbilling_
PORT=5000
```

(These are the same host/user/password/port you use to log into MySQL
Workbench itself.)

## 3. Run it

```bash
npm run dev     # auto-restarts on file changes (nodemon)
# or
npm start
```

You should see:

```
✅ Server running: http://localhost:5000
✅ Health check:   http://localhost:5000/api/health
```

Open `http://localhost:5000/api/health` in a browser — if it returns
`{"success":true,"db":"connected"}` your Node app is correctly talking to
MySQL Workbench's database.

## 4. API Endpoints

Every resource below supports the same 5 operations:

| Method | URL                          | Purpose                     |
|--------|------------------------------|------------------------------|
| GET    | `/api/<resource>`            | List all rows (paginated)    |
| GET    | `/api/<resource>/:id`        | Get one row by id            |
| POST   | `/api/<resource>`            | Create a new row             |
| PUT    | `/api/<resource>/:id`        | Update a row                 |
| DELETE | `/api/<resource>/:id`        | Delete a row                 |

Resources (mapped in `routes/index.js`):

- `/api/billing-locations` → `billing_location` table
- `/api/clients` → `clients` table
- `/api/financial-years` → `financial_year` table
- `/api/tax-master` → `tax_master` table
- `/api/invoices` → invoice tables (see section 4b)

### List with pagination

```
GET /api/clients?limit=20&offset=0
```

```json
{
  "success": true,
  "data": [ { "id": 1, "client_code": "C001", "business_name": "..." } ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### Create a row

```
POST /api/clients
Content-Type: application/json

{
  "client_code": "C001",
  "business_name": "Acme Pvt Ltd",
  "contact_person": "Ramesh",
  "phone": "9876543210",
  "email": "ramesh@acme.com",
  "state_code": "27",
  "city": "Mumbai"
}
```

Send only the fields you have — anything not in the request body is simply
left out of the INSERT, so your table's own defaults apply.

### Update a row

```
PUT /api/clients/1
Content-Type: application/json

{ "phone": "9999999999" }
```

Partial updates work — only the fields you send get changed.

### Delete a row

```
DELETE /api/clients/1
```

## 4b. Invoices (own tables + own controller)

Invoices are saved in 4 tables. Create them once (they are NOT part of the
generic CRUD, because saving one writes to several tables in one transaction):

```bash
npm run migrate              # creates the tables (safe to re-run)
npm run migrate -- --print   # only print the SQL, e.g. to run it in Workbench
```

| Table                     | What it holds |
|---------------------------|---------------|
| `invoice_sequences`       | last invoice number used per billing location + financial year |
| `invoices`                | one row per invoice: number, date, type (DIRECT/MILESTONE), link to `clients` and `billing_location`, a copy (snapshot) of the client details, totals, payment status, terms |
| `invoice_items`           | service lines: description, qty, price, billed %, tax rate, taxable / tax / line total |
| `invoice_item_milestones` | Milestone 1, 2, 3 ... of an item: %, amount, and which one is billed on this invoice |

Endpoints:

| Method | URL                                              | Purpose |
|--------|--------------------------------------------------|---------|
| GET    | `/api/invoices?limit=&offset=`                   | list, newest first |
| GET    | `/api/invoices/next-number?location_id=&date=`   | preview of the next number (does not use it up) |
| GET    | `/api/invoices/:id`                              | one invoice with items + milestones |
| POST   | `/api/invoices`                                  | create (all-or-nothing transaction) |
| PATCH  | `/api/invoices/:id/status`                       | `{ "payment_status": "PAID" \| "PENDING" }` |

How it behaves:

- The browser only sends raw inputs. **Taxable amount, tax and totals are
  recalculated on the server** (`utils/invoiceMath.js`) before saving.
- The invoice number (`RFZ/<FY>/<0000>`) is handed out inside the same
  transaction as the invoice, so a failed save never burns a number.
  GST locations start at 0001, non-GST at 1001.
- `client_id` points to `clients` (Client Master). The client's details are
  also copied onto the invoice, so editing or deleting a client later never
  changes an old invoice (`ON DELETE SET NULL`). `client_id` is NULL when the
  client was typed in by hand instead of picked from Client Master.
- `billing_location_id` must be an id that really exists in `billing_location`.

## 5. Adding a new table later

You don't need to touch the controller at all. Just add one line in
`routes/index.js`:

```js
router.use('/vendors', createCrudRouter('vendors'));
```

As long as a table called `vendors` exists in the same database, full CRUD
for it is live immediately — the actual columns are still discovered from
the database automatically.

## 6. Connecting your React frontend (`invoice-frontend`)

In your frontend, point API calls at `http://localhost:5000/api/...`, e.g.:

```js
// src/api/clients.js
const API_BASE = 'http://localhost:5000/api';

export async function getClients() {
  const res = await fetch(`${API_BASE}/clients`);
  return res.json();
}

export async function createClient(data) {
  const res = await fetch(`${API_BASE}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

During development, if your frontend runs on Vite's default port (5173) and
the backend on 5000, CORS is already enabled (`cors()` in `server.js`), so
calls will just work.

## 7. Folder structure

```
invoice-backend/
├── config/
│   └── db.js              # MySQL connection pool (reads .env)
├── controllers/
│   └── genericController.js  # CRUD logic, driven by live schema
├── routes/
│   ├── genericRoutes.js   # 5 REST routes per table
│   └── index.js           # maps table names -> URL paths
├── utils/
│   └── schemaUtils.js     # reads INFORMATION_SCHEMA, caches column list
├── .env.example
├── .gitignore
├── package.json
├── server.js               # app entry point
└── README.md
```

## Notes

- Table/column names are validated against `INFORMATION_SCHEMA` before any
  query is built, so user input can never inject arbitrary column or table
  names — only real, existing ones are ever used, and all values are sent
  as parameterized query placeholders.
- If you rename or add columns in Workbench while the server is running,
  either restart the server or call `clearSchemaCache()` (exported from
  `utils/schemaUtils.js`) to refresh the cached column list.
- Every response follows `{ success, data | message }` so your frontend
  error handling can be consistent across all resources.
