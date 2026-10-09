// scripts/migrate.js
//
// Creates the invoice tables in your existing MySQL database (rfzBilling_):
//
//   invoice_sequences        — last used invoice number per location + financial year
//   invoices                 — one row per invoice (header, client snapshot, totals)
//   invoice_items            — service lines of an invoice
//   invoice_item_milestones  — payment split (Milestone 1, 2, 3 ...) of an item
//
// Run from the invoice-backend folder:
//
//   npm run migrate              # creates the tables (safe to re-run: CREATE TABLE IF NOT EXISTS)
//   npm run migrate -- --print   # only prints the SQL, e.g. to run it manually in Workbench
//
// Foreign keys must use EXACTLY the same column type as the column they
// point to (INT vs BIGINT, signed vs UNSIGNED...). Since we can't know how
// `clients.id` / `billing_location.id` were created in Workbench, this
// script reads their real type from INFORMATION_SCHEMA and reuses it.

require('dotenv').config();
const pool = require('../config/db');

const PRINT_ONLY = process.argv.includes('--print');

async function getPrimaryKeyInfo(table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'
      ORDER BY ORDINAL_POSITION`,
    [table]
  );
  if (rows.length === 0) {
    throw new Error(`Table "${table}" not found (or has no primary key) in database "${process.env.DB_NAME}".`);
  }
  if (rows.length > 1) {
    throw new Error(`Table "${table}" has a composite primary key — this script expects a single id column.`);
  }

  const [tables] = await pool.query(
    `SELECT ENGINE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  const engine = tables[0] && tables[0].ENGINE;
  if (engine && engine.toUpperCase() !== 'INNODB') {
    throw new Error(
      `Table "${table}" uses the ${engine} engine, but foreign keys need InnoDB. ` +
        `Run: ALTER TABLE ${table} ENGINE=InnoDB;  and then re-run the migration.`
    );
  }

  return { column: rows[0].COLUMN_NAME, type: rows[0].COLUMN_TYPE };
}

function buildStatements(loc, client) {
  const engine = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

  return [
    {
      name: 'invoice_sequences',
      sql: `CREATE TABLE IF NOT EXISTS invoice_sequences (
  billing_location_id ${loc.type} NOT NULL,
  financial_year      CHAR(4) NOT NULL COMMENT 'e.g. 2627 for FY 2026-27',
  last_sequence       INT UNSIGNED NOT NULL COMMENT 'last invoice sequence number handed out',
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (billing_location_id, financial_year),
  CONSTRAINT fk_invseq_location FOREIGN KEY (billing_location_id)
    REFERENCES billing_location (${loc.column}) ON UPDATE CASCADE
) ${engine}`,
    },
    {
      name: 'invoices',
      sql: `CREATE TABLE IF NOT EXISTS invoices (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_number      VARCHAR(30) NOT NULL COMMENT 'RFZ/<FY>/<0000>',
  billing_location_id ${loc.type} NOT NULL,
  financial_year      CHAR(4) NOT NULL,
  sequence_number     INT UNSIGNED NOT NULL,
  invoice_date        DATE NOT NULL,
  invoice_type        ENUM('DIRECT','MILESTONE') NOT NULL DEFAULT 'DIRECT',

  client_id           ${client.type} NULL COMMENT 'link to Client Master; NULL if the client was typed in manually',
  client_name         VARCHAR(200) NOT NULL COMMENT 'client details are copied (snapshot) so old invoices never change',
  client_contact      VARCHAR(200) NOT NULL,
  client_address      TEXT NULL,
  client_state        VARCHAR(60) NULL,
  client_pan          VARCHAR(10) NULL,
  client_gst_number   VARCHAR(15) NULL,

  gross_amount        DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'sum of total_price x qty (before % split)',
  subtotal_amount     DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'taxable amount actually billed',
  gst_percentage      DECIMAL(5,2)  NULL COMMENT 'blended rate, NULL for non-GST locations',
  gst_amount          DECIMAL(14,2) NULL,
  total_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,

  payment_status      ENUM('PENDING','PAID') NOT NULL DEFAULT 'PENDING',
  paid_at             DATETIME NULL,
  payment_mode        VARCHAR(20) NULL,
  payment_reference   VARCHAR(100) NULL COMMENT 'reference / transaction / cheque no. entered when marked PAID',
  payment_date        DATE NULL COMMENT 'date the payment was received',
  amount_paid         DECIMAL(14,2) NULL COMMENT 'total amount received',
  terms               TEXT NULL,
  show_bank_details   TINYINT(1) NOT NULL DEFAULT 1,

  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_number (billing_location_id, invoice_number),
  UNIQUE KEY uq_invoice_sequence (billing_location_id, financial_year, sequence_number),
  KEY idx_invoices_client (client_id),
  KEY idx_invoices_date (invoice_date),
  KEY idx_invoices_status (payment_status),
  CONSTRAINT fk_invoices_location FOREIGN KEY (billing_location_id)
    REFERENCES billing_location (${loc.column}) ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_client FOREIGN KEY (client_id)
    REFERENCES clients (${client.column}) ON UPDATE CASCADE ON DELETE SET NULL
) ${engine}`,
    },
    {
      name: 'invoice_items',
      sql: `CREATE TABLE IF NOT EXISTS invoice_items (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id          BIGINT UNSIGNED NOT NULL,
  line_no             SMALLINT UNSIGNED NOT NULL,
  service_description VARCHAR(255) NOT NULL,
  qty                 DECIMAL(10,2) NOT NULL DEFAULT 1,
  total_price         DECIMAL(14,2) NOT NULL COMMENT 'price of one unit before the % split',
  price_percentage    DECIMAL(5,2)  NOT NULL DEFAULT 100 COMMENT '% billed on this invoice (billed milestone for MILESTONE invoices)',
  tax_rate            DECIMAL(5,2)  NOT NULL DEFAULT 0,
  taxable_amount      DECIMAL(14,2) NOT NULL,
  tax_amount          DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total          DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_line (invoice_id, line_no),
  CONSTRAINT fk_items_invoice FOREIGN KEY (invoice_id)
    REFERENCES invoices (id) ON DELETE CASCADE
) ${engine}`,
    },
    {
      name: 'invoice_item_milestones',
      sql: `CREATE TABLE IF NOT EXISTS invoice_item_milestones (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_item_id BIGINT UNSIGNED NOT NULL,
  milestone_no    SMALLINT UNSIGNED NOT NULL,
  label           VARCHAR(30) NOT NULL,
  percent         DECIMAL(5,2)  NOT NULL,
  amount          DECIMAL(14,2) NOT NULL COMMENT 'total_price x qty x percent / 100',
  is_billed       TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = this is the milestone billed on this invoice',
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_milestone (invoice_item_id, milestone_no),
  CONSTRAINT fk_milestones_item FOREIGN KEY (invoice_item_id)
    REFERENCES invoice_items (id) ON DELETE CASCADE
) ${engine}`,
    },
  ];
}

async function main() {
  const loc = await getPrimaryKeyInfo('billing_location').then((r) => ({ column: r.column, type: r.type }));
  const client = await getPrimaryKeyInfo('clients').then((r) => ({ column: r.column, type: r.type }));

  console.log(`billing_location primary key: ${loc.column} (${loc.type})`);
  console.log(`clients primary key:          ${client.column} (${client.type})\n`);

  const statements = buildStatements(loc, client);

  if (PRINT_ONLY) {
    statements.forEach((s) => console.log(`${s.sql};\n`));
    return;
  }

  for (const s of statements) {
    await pool.query(s.sql);
    console.log(`✅ ${s.name}`);
  }

  // Existing databases: add the payment columns if the invoices table was
  // created before they existed (safe to re-run).
  const wanted = [
    ['payment_reference', "VARCHAR(100) NULL COMMENT 'reference / transaction / cheque no. entered when marked PAID'"],
    ['payment_date', "DATE NULL COMMENT 'date the payment was received'"],
    ['amount_paid', "DECIMAL(14,2) NULL COMMENT 'total amount received'"],
  ];
  for (const [col, def] of wanted) {
    const [found] = await pool.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = ?`,
      [col]
    );
    if (found.length === 0) {
      await pool.query(`ALTER TABLE invoices ADD COLUMN ${col} ${def}`);
      console.log(`✅ added invoices.${col}`);
    }
  }

  // The frontend's billing-location dropdown currently uses ids 1 and 2
  // (see invoice-frontend/src/data/billingLocations.js). An invoice can only
  // be saved for a location id that really exists in billing_location, so
  // show what is actually there.
  const [locations] = await pool.query(`SELECT * FROM billing_location`);
  console.log('\nbilling_location rows currently in the database (invoices can only use these ids):');
  locations.forEach((row) => {
    const label = row.location_name || row.name || row.location_code || '';
    console.log(`  id ${row[loc.column]}  ${label}`);
  });
  if (locations.length === 0) console.log('  (none!) — add your billing locations first.');
}

main()
  .catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
