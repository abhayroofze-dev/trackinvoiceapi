// scripts/check-proposals.js   ->   npm run check:proposals
//
// Tells you exactly what is missing for the Proposal module to work:
// .env, MySQL connection, sanitize-html, the 10 tables, the Terms templates.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ok = (m) => console.log(`  \u2705 ${m}`);
const bad = (m, fix) => {
  console.log(`  \u274C ${m}`);
  if (fix) console.log(`     \u2192 ${fix}`);
  failed = true;
};
let failed = false;

const TABLES = [
  'proposal_sequences', 'terms_master', 'proposals', 'proposal_sections', 'proposal_section_contents',
  'proposal_section_tables', 'proposal_table_columns', 'proposal_table_rows', 'proposal_table_cells',
  'proposal_section_terms',
];

async function main() {
  console.log('\n1. Files / packages');
  if (fs.existsSync(path.join(__dirname, '..', '.env'))) ok('.env found');
  else bad('.env missing', 'copy .env.example to .env and put your MySQL password');
  try {
    require.resolve('sanitize-html');
    ok('sanitize-html installed');
  } catch {
    bad('sanitize-html NOT installed', 'run: npm install');
  }
  ['controllers/proposalController.js', 'routes/proposalRoutes.js', 'utils/proposalHtml.js'].forEach((f) =>
    fs.existsSync(path.join(__dirname, '..', f)) ? ok(f) : bad(`${f} missing`, 'copy the new backend files again')
  );
  const idx = fs.readFileSync(path.join(__dirname, '..', 'routes', 'index.js'), 'utf8');
  idx.includes("'/proposals'") ? ok('routes/index.js has /proposals') : bad('routes/index.js does not register /proposals', 'use the updated routes/index.js');
  idx.includes("'/terms-master'") ? ok('routes/index.js has /terms-master') : bad('routes/index.js does not register /terms-master', 'use the updated routes/index.js');
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  /limit/.test(srv) ? ok('server.js JSON limit raised') : bad('server.js still has the small default JSON limit (images will fail)', "use express.json({ limit: '25mb' })");

  console.log('\n2. Database');
  const pool = require('../config/db');
  try {
    const [[r]] = await pool.query('SELECT DATABASE() AS db, VERSION() AS v');
    ok(`connected to "${r.db}" (MySQL/MariaDB ${r.v})`);
  } catch (e) {
    bad(`cannot connect: ${e.message}`, 'check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in .env and that MySQL is running');
    await pool.end();
    return;
  }

  const [have] = await pool.query(
    'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)',
    [TABLES]
  );
  const haveSet = new Set(have.map((t) => t.TABLE_NAME));
  const missing = TABLES.filter((t) => !haveSet.has(t));
  if (missing.length) bad(`missing tables: ${missing.join(', ')}`, 'start the server once (it creates them automatically) or run: npm run migrate:proposals');
  else ok('all 10 proposal tables exist');

  // table structure sanity (catches an older/partial table with the same name)
  const needCols = {
    proposals: ['proposal_number', 'client_name', 'proposal_title', 'cover_tagline', 'proposal_date', 'valid_till', 'status'],
    proposal_sections: ['proposal_id', 'section_type', 'title', 'sort_order', 'is_mandatory'],
    terms_master: ['title', 'content', 'is_default', 'is_active'],
    proposal_section_terms: ['section_id', 'terms_master_id', 'content_snapshot'],
  };
  for (const [table, cols] of Object.entries(needCols)) {
    if (!haveSet.has(table)) continue;
    const [c] = await pool.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table]
    );
    const names = new Set(c.map((x) => x.COLUMN_NAME));
    const lack = cols.filter((x) => !names.has(x));
    if (lack.length) bad(`${table} is missing column(s): ${lack.join(', ')}`, `this table already existed with a different structure - rename/drop it in Workbench, then run: npm run migrate:proposals`);
  }

  if (haveSet.has('terms_master')) {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM terms_master WHERE is_active = 1');
    n > 0 ? ok(`${n} active Terms template(s)`) : bad('terms_master has no active templates', 'run: npm run migrate:proposals (seeds 5 templates)');
  }

  const [[{ n: clients }]] = await pool.query('SELECT COUNT(*) AS n FROM clients').catch(() => [[{ n: -1 }]]);
  clients > 0 ? ok(`${clients} client(s) available`) : bad('no clients found - the proposal client dropdown will be empty', 'add a client in the Clients page');

  await pool.end();
}

main()
  .catch((e) => {
    console.error('Check crashed:', e.message);
    failed = true;
  })
  .finally(() => {
    console.log(failed ? '\n\u274C Fix the items above, then run this check again.\n' : '\n\u2705 Everything looks good. Start the server with: npm run dev\n');
    process.exitCode = failed ? 1 : 0;
  });
