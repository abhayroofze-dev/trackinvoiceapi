// scripts/migrate-proposals.js
//
// Creates the dynamic Proposal Builder tables in your existing MySQL database:
//
//   proposal_sequences        last proposal number used per financial year
//   terms_master              reusable Terms & Conditions templates
//   proposals                 one row per proposal (header only)
//   proposal_sections         unlimited sections per proposal (CONTENT / TABLE / TERMS), ordered by sort_order
//   proposal_section_contents rich-text HTML of a CONTENT section
//   proposal_section_tables   table config of a TABLE section
//   proposal_table_columns    columns of a table   (dynamic - no column_1, column_2 ...)
//   proposal_table_rows       rows of a table      (dynamic)
//   proposal_table_cells      one row per (row, column) cell value
//   proposal_section_terms    TERMS section: chosen template + frozen content snapshot
//
// Run from the invoice-backend folder:
//
//   npm run migrate:proposals              # create tables + seed Terms templates (safe to re-run)
//   npm run migrate:proposals -- --print   # only print the SQL (to run manually in Workbench)

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
  if (rows.length !== 1) {
    throw new Error(`Table "${table}" not found (or has no single primary key) in database "${process.env.DB_NAME}".`);
  }
  const [t] = await pool.query(
    'SELECT ENGINE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table]
  );
  const engine = (t[0] && t[0].ENGINE) || '';
  return { column: rows[0].COLUMN_NAME, type: rows[0].COLUMN_TYPE, innodb: engine.toUpperCase() === 'INNODB' };
}

function buildStatements(client) {
  const engine = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

  return [
    {
      name: 'proposal_sequences',
      sql: `CREATE TABLE IF NOT EXISTS proposal_sequences (
  financial_year CHAR(4) NOT NULL COMMENT 'e.g. 2627 for FY 2026-27',
  last_sequence  INT UNSIGNED NOT NULL,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (financial_year)
) ${engine}`,
    },
    {
      name: 'terms_master',
      sql: `CREATE TABLE IF NOT EXISTS terms_master (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title      VARCHAR(150) NOT NULL,
  content    MEDIUMTEXT NOT NULL COMMENT 'HTML',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ${engine}`,
    },
    {
      name: 'proposals',
      sql: `CREATE TABLE IF NOT EXISTS proposals (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposal_number VARCHAR(30) NOT NULL COMMENT 'RFZ/<FY>/<0000>',
  financial_year  CHAR(4) NOT NULL,
  sequence_number INT UNSIGNED NOT NULL,
  client_id       ${client.type} NULL,
  client_name     VARCHAR(200) NULL COMMENT 'snapshot of the client name, so old proposals never change',
  proposal_title  VARCHAR(255) NOT NULL DEFAULT '',
  cover_tagline   VARCHAR(255) NULL COMMENT 'line under the title on the cover page',
  proposal_date   DATE NOT NULL,
  valid_till      DATE NULL,
  status          ENUM('DRAFT','FINALIZED') NOT NULL DEFAULT 'DRAFT',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_proposal_number (proposal_number),
  KEY idx_proposals_client (client_id),
  KEY idx_proposals_date (proposal_date),
  KEY idx_proposals_status (status)${
    client.innodb
      ? `,
  CONSTRAINT fk_proposals_client FOREIGN KEY (client_id)
    REFERENCES clients (${client.column}) ON UPDATE CASCADE ON DELETE SET NULL`
      : '' // clients is not InnoDB (e.g. MyISAM): a foreign key is impossible, so the link is kept without one
  }
) ${engine}`,
    },
    {
      name: 'proposal_sections',
      sql: `CREATE TABLE IF NOT EXISTS proposal_sections (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposal_id  BIGINT UNSIGNED NOT NULL,
  section_type ENUM('CONTENT','TABLE','TERMS') NOT NULL,
  title        VARCHAR(255) NOT NULL DEFAULT '',
  sort_order   INT UNSIGNED NOT NULL,
  is_mandatory TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sections_order (proposal_id, sort_order),
  CONSTRAINT fk_sections_proposal FOREIGN KEY (proposal_id)
    REFERENCES proposals (id) ON DELETE CASCADE
) ${engine}`,
    },
    {
      name: 'proposal_section_contents',
      sql: `CREATE TABLE IF NOT EXISTS proposal_section_contents (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id   BIGINT UNSIGNED NOT NULL,
  content_html MEDIUMTEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_content_section (section_id),
  CONSTRAINT fk_contents_section FOREIGN KEY (section_id)
    REFERENCES proposal_sections (id) ON DELETE CASCADE
) ${engine}`,
    },
    {
      name: 'proposal_section_tables',
      sql: `CREATE TABLE IF NOT EXISTS proposal_section_tables (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id   BIGINT UNSIGNED NOT NULL,
  column_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  row_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_table_section (section_id),
  CONSTRAINT fk_tables_section FOREIGN KEY (section_id)
    REFERENCES proposal_sections (id) ON DELETE CASCADE
) ${engine}`,
    },
    {
      name: 'proposal_table_columns',
      sql: `CREATE TABLE IF NOT EXISTS proposal_table_columns (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id   BIGINT UNSIGNED NOT NULL,
  column_index SMALLINT UNSIGNED NOT NULL,
  column_name  VARCHAR(255) NOT NULL DEFAULT '',
  sort_order   SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_columns_section (section_id, sort_order),
  CONSTRAINT fk_columns_section FOREIGN KEY (section_id)
    REFERENCES proposal_sections (id) ON DELETE CASCADE
) ${engine}`,
    },
    {
      name: 'proposal_table_rows',
      sql: `CREATE TABLE IF NOT EXISTS proposal_table_rows (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  row_index  SMALLINT UNSIGNED NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_rows_section (section_id, sort_order),
  CONSTRAINT fk_rows_section FOREIGN KEY (section_id)
    REFERENCES proposal_sections (id) ON DELETE CASCADE
) ${engine}`,
    },
    {
      name: 'proposal_table_cells',
      sql: `CREATE TABLE IF NOT EXISTS proposal_table_cells (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id BIGINT UNSIGNED NOT NULL,
  row_id     BIGINT UNSIGNED NOT NULL,
  column_id  BIGINT UNSIGNED NOT NULL,
  cell_value TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cell (row_id, column_id),
  KEY idx_cells_section (section_id),
  CONSTRAINT fk_cells_section FOREIGN KEY (section_id)
    REFERENCES proposal_sections (id) ON DELETE CASCADE,
  CONSTRAINT fk_cells_row FOREIGN KEY (row_id)
    REFERENCES proposal_table_rows (id) ON DELETE CASCADE,
  CONSTRAINT fk_cells_column FOREIGN KEY (column_id)
    REFERENCES proposal_table_columns (id) ON DELETE CASCADE
) ${engine}`,
    },
    {
      name: 'proposal_section_terms',
      sql: `CREATE TABLE IF NOT EXISTS proposal_section_terms (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_id       BIGINT UNSIGNED NOT NULL,
  terms_master_id  BIGINT UNSIGNED NULL,
  content_snapshot MEDIUMTEXT NULL COMMENT 'copy of the terms at save time - later edits to terms_master never change old proposals',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_terms_section (section_id),
  CONSTRAINT fk_terms_section FOREIGN KEY (section_id)
    REFERENCES proposal_sections (id) ON DELETE CASCADE,
  CONSTRAINT fk_terms_master FOREIGN KEY (terms_master_id)
    REFERENCES terms_master (id) ON DELETE SET NULL
) ${engine}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Starter templates. Website Development Terms = the text from your E-Commerce
// proposal PDF. The others are sensible starting points - edit them from the
// terms_master table (or the Terms page) to match your real policies.
// ---------------------------------------------------------------------------
const li = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const block = (heading, items) => `<p><strong>${heading}</strong></p>${li(items)}`;

const SEED_TERMS = [
  {
    title: 'General Terms',
    is_default: 0,
    content: [
      block('1. Payment Terms :', [
        '50% advance payment before starting the project.',
        'Remaining 50% payment upon project completion and delivery.',
      ]),
      block('2. Scope Changes :', [
        'This quotation is based on the scope described in this proposal. Any additional work will be quoted separately.',
      ]),
      block('3. Cancellation Policy :', [
        'If the client cancels the project after the advance payment and initial work, the advance payment will not be refundable.',
        'If we cancel the project after receiving the advance payment, the entire payment will be refunded.',
      ]),
      block('4. Taxes :', ['GST and other applicable taxes are charged extra unless mentioned otherwise.']),
    ].join(''),
  },
  {
    title: 'Website Development Terms',
    is_default: 0,
    content: [
      block('1. Payment Terms :', [
        '50% advance payment before starting the project.',
        'Remaining 50% payment upon project completion and delivery.',
      ]),
      block('2. Ownership and Maintenance :', [
        'After project completion, if you do not wish to continue maintenance with us, your domain and website will be handed over in working condition.',
        'Any future maintenance or service will be charged based on an AMC or request basis, as per the client\u2019s requirements.',
      ]),
      block('3. Cancellation Policy :', [
        'If the client cancels the project after the advance payment and initial work, the advance payment will not be refundable.',
        'If we cancel the project after receiving the advance payment, the entire payment will be refunded.',
      ]),
      block('4. Scope Changes :', [
        'This quotation is based on a basic website structure. Any additional advanced functionalities will be quoted separately.',
      ]),
      block('5. Renewal Costs :', [
        'After the 1st year, maintenance costs \u20B97,000/year.',
        'Includes: Performance Optimization \u2013 checking speed, fixing broken links, and compressing images.',
        'Mobile &amp; Browser Compatibility \u2013 ensuring your site looks good across all devices and browsers.',
        'Bug Fixes &amp; Minor Tweaks \u2013 removing outdated scripts, fixing any minor errors, and improving UI.',
        'Third-Party Integrations \u2013 if you use forms, APIs, or embedded tools, they need occasional updates and troubleshooting.',
      ]),
      '<p>We are dedicated to delivering a website that exceeds your expectations. Please feel free to share your feedback or additional requirements.</p>',
    ].join(''),
  },
  {
    title: 'Software Development Terms',
    is_default: 0,
    content: [
      block('1. Payment Terms :', [
        '40% advance payment before starting the project.',
        '30% on completion of the agreed development milestone.',
        '30% on final delivery / go-live.',
      ]),
      block('2. Requirements &amp; Change Requests :', [
        'The project is based on the requirements agreed in this proposal. Any change in requirements will be estimated and billed separately.',
      ]),
      block('3. Intellectual Property :', [
        'Source code and project ownership are transferred to the client after full payment is received.',
      ]),
      block('4. Support :', [
        'Free bug-fixing support for 30 days after delivery. Further support is available on an AMC or request basis.',
      ]),
      block('5. Cancellation Policy :', [
        'Advance payment is non-refundable once development work has started.',
      ]),
    ].join(''),
  },
  {
    title: 'Digital Marketing Terms',
    is_default: 0,
    content: [
      block('1. Payment Terms :', [
        'Monthly fees are payable in advance, before the start of each month.',
        'Advertising spend on Google / Meta and other platforms is paid by the client directly and is not included in our fees.',
      ]),
      block('2. Results :', [
        'We work to improve reach, leads and conversions; however no specific results or rankings are guaranteed.',
      ]),
      block('3. Client Responsibilities :', [
        'The client will provide timely approvals, product / service information, access to accounts and creative assets.',
      ]),
      block('4. Minimum Commitment &amp; Cancellation :', [
        'A minimum commitment of 3 months applies. Either party may stop the service with 15 days\u2019 written notice after that.',
      ]),
      block('5. Taxes :', ['GST at 18% is charged extra on all professional fees.']),
    ].join(''),
  },
  {
    title: 'Social Media Terms',
    is_default: 1,
    content: [
      block('1. Payment Terms :', [
        'Monthly fees are payable in advance, before the start of each month.',
        'GST at 18% is charged extra.',
      ]),
      block('2. Content &amp; Approvals :', [
        'Creative posts and reels are shared for approval before publishing. Delay in approvals may affect the posting schedule.',
        'Deliverables not used within the month do not carry over to the next month.',
      ]),
      block('3. Client Responsibilities :', [
        'The client will provide brand assets, product information, and timely access to the social media accounts.',
        'Video shoots, models and props, if required, are arranged by the client unless agreed otherwise.',
      ]),
      block('4. Advertising Budget :', [
        'Ad spend paid to the platforms is separate and is billed directly to the client\u2019s ad account.',
      ]),
      block('5. Cancellation Policy :', [
        'Either party may end the service with 15 days\u2019 written notice. Fees already paid for the running month are non-refundable.',
      ]),
    ].join(''),
  },
];

async function seedTerms() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM terms_master');
  if (n > 0) {
    console.log(`terms_master already has ${n} template(s) - skipped seeding.`);
    return;
  }
  for (const t of SEED_TERMS) {
    await pool.query('INSERT INTO terms_master (title, content, is_default, is_active) VALUES (?, ?, ?, 1)', [
      t.title,
      t.content,
      t.is_default,
    ]);
  }
  console.log(`\u2705 seeded ${SEED_TERMS.length} Terms & Conditions templates`);
}

/**
 * Creates every proposal table (CREATE TABLE IF NOT EXISTS) and seeds the Terms templates once.
 * Used by `npm run migrate:proposals` AND automatically when the server starts,
 * so nobody has to remember to run the migration.
 */
async function ensureProposalTables({ log = console.log } = {}) {
  const client = await getPrimaryKeyInfo('clients');
  if (!client.innodb) {
    log('\u26A0\uFE0F  clients table is not InnoDB - proposals.client_id will be created without a foreign key.');
  }
  const statements = buildStatements(client);
  for (const s of statements) {
    await pool.query(s.sql);
    log(`\u2705 ${s.name}`);
  }
  await seedTerms();
  return statements;
}

async function main() {
  const client = await getPrimaryKeyInfo('clients');
  console.log(`clients primary key: ${client.column} (${client.type})\n`);

  if (PRINT_ONLY) {
    buildStatements(client).forEach((s) => console.log(`${s.sql};\n`));
    return;
  }
  await ensureProposalTables();
}

module.exports = { ensureProposalTables };

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('\u274C Migration failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
