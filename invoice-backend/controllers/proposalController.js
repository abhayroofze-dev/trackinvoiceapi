// controllers/proposalController.js
//
// Dynamic block-based Proposal Builder.
//
//   GET    /api/proposals                    list (header rows)
//   GET    /api/proposals/next-number        preview of the next number (does NOT consume it)
//   GET    /api/proposals/:id                one proposal with all its sections (ordered by sort_order)
//   POST   /api/proposals                    create (saved as DRAFT, takes a proposal number)
//   PUT    /api/proposals/:id                save header + the whole section list (transaction)
//   POST   /api/proposals/:id/finalize       validate (client, title, date, Terms ...) and mark FINALIZED
//   PATCH  /api/proposals/:id/status         { status: 'DRAFT' } re-open a finalized proposal
//   DELETE /api/proposals/:id
//
// How the "dynamic" part works
// ----------------------------
// The browser sends the list of sections in the order the user arranged them.
// Each section is either already saved (numeric id) or new (temporary id such
// as "tmp-3"). saveSections() then
//   * keeps every existing row (same id) and only updates title + sort_order,
//     so dragging a section never copies or moves its data;
//   * inserts new sections, deletes removed ones;
//   * for TABLE sections does the same for columns / rows and rewrites the cells.
// Nothing here knows how many sections, columns or rows a proposal has.

const pool = require('../config/db');
const { HttpError, getFinancialYear } = require('../utils/invoiceMath');
const { cleanHtml, isHtmlEmpty } = require('../utils/proposalHtml');

const SECTION_TYPES = ['CONTENT', 'TABLE', 'TERMS'];
const MAX_SECTIONS = 200;
const MAX_COLUMNS = 20;
const MAX_ROWS = 500;

const MSG_TERMS_MANDATORY = 'Terms & Conditions are mandatory and cannot be removed.';
const MSG_TERMS_MISSING = 'Terms & Conditions are mandatory before finalizing the proposal.';
const MSG_TERMS_EMPTY = 'Please add Terms & Conditions before finalizing the proposal.';

const num = (v) => (v === null || v === undefined ? null : Number(v));
const str = (v, max) => {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s === '' ? null : s.slice(0, max);
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function handleError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      success: false,
      message: 'Proposal tables are missing in the database. Run "npm run migrate:proposals" in invoice-backend first.',
    });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'That proposal number was just taken \u2014 please save again.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ success: false, message: 'The selected client or Terms template no longer exists.' });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const HEADER_COLUMNS = `
  p.id, p.proposal_number, p.financial_year, p.sequence_number, p.client_id, p.client_name,
  p.proposal_title, p.cover_tagline,
  DATE_FORMAT(p.proposal_date, '%Y-%m-%d') AS proposal_date,
  DATE_FORMAT(p.valid_till, '%Y-%m-%d') AS valid_till,
  p.status,
  UNIX_TIMESTAMP(p.created_at) * 1000 AS created_at_ms,
  UNIX_TIMESTAMP(p.updated_at) * 1000 AS updated_at_ms`;

function serializeHeader(r) {
  return {
    id: r.id,
    proposal_number: r.proposal_number,
    financial_year: r.financial_year,
    sequence_number: r.sequence_number,
    client_id: r.client_id,
    client_name: r.client_name,
    proposal_title: r.proposal_title,
    cover_tagline: r.cover_tagline,
    proposal_date: r.proposal_date,
    valid_till: r.valid_till,
    status: r.status,
    created_at_ms: num(r.created_at_ms),
    updated_at_ms: num(r.updated_at_ms),
  };
}

/** Loads sections of one proposal with their content / table / terms, ordered by sort_order. */
async function loadSections(conn, proposalId) {
  const [sections] = await conn.query(
    'SELECT * FROM proposal_sections WHERE proposal_id = ? ORDER BY sort_order ASC, id ASC',
    [proposalId]
  );
  if (sections.length === 0) return [];
  const ids = sections.map((s) => s.id);

  const [contents] = await conn.query('SELECT * FROM proposal_section_contents WHERE section_id IN (?)', [ids]);
  const [terms] = await conn.query('SELECT * FROM proposal_section_terms WHERE section_id IN (?)', [ids]);
  const [columns] = await conn.query(
    'SELECT * FROM proposal_table_columns WHERE section_id IN (?) ORDER BY section_id, sort_order, id',
    [ids]
  );
  const [rows] = await conn.query(
    'SELECT * FROM proposal_table_rows WHERE section_id IN (?) ORDER BY section_id, sort_order, id',
    [ids]
  );
  const [cells] = await conn.query('SELECT * FROM proposal_table_cells WHERE section_id IN (?)', [ids]);

  const contentBySection = new Map(contents.map((c) => [c.section_id, c]));
  const termsBySection = new Map(terms.map((t) => [t.section_id, t]));
  const colsBySection = new Map();
  columns.forEach((c) => {
    if (!colsBySection.has(c.section_id)) colsBySection.set(c.section_id, []);
    colsBySection.get(c.section_id).push({ id: c.id, name: c.column_name });
  });
  const cellsByRow = new Map();
  cells.forEach((c) => {
    if (!cellsByRow.has(c.row_id)) cellsByRow.set(c.row_id, {});
    cellsByRow.get(c.row_id)[c.column_id] = c.cell_value === null ? '' : c.cell_value;
  });
  const rowsBySection = new Map();
  rows.forEach((r) => {
    if (!rowsBySection.has(r.section_id)) rowsBySection.set(r.section_id, []);
    rowsBySection.get(r.section_id).push({ id: r.id, cells: cellsByRow.get(r.id) || {} });
  });

  return sections.map((s) => {
    const out = {
      id: s.id,
      section_type: s.section_type,
      title: s.title,
      sort_order: s.sort_order,
      is_mandatory: !!s.is_mandatory,
    };
    if (s.section_type === 'CONTENT') {
      out.content_html = contentBySection.get(s.id)?.content_html || '';
    } else if (s.section_type === 'TABLE') {
      out.table = { columns: colsBySection.get(s.id) || [], rows: rowsBySection.get(s.id) || [] };
    } else if (s.section_type === 'TERMS') {
      const t = termsBySection.get(s.id);
      out.terms = {
        terms_master_id: t ? t.terms_master_id : null,
        content_snapshot: t?.content_snapshot || '',
      };
    }
    return out;
  });
}

async function loadProposal(conn, id) {
  const [rows] = await conn.query(`SELECT ${HEADER_COLUMNS} FROM proposals p WHERE p.id = ?`, [id]);
  if (rows.length === 0) return null;
  const proposal = serializeHeader(rows[0]);
  proposal.sections = await loadSections(conn, id);
  return proposal;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Rules that must hold before a proposal can be FINALIZED (also run on every save of a finalized one). */
function validateForFinalize(p) {
  if (!p.client_id && !p.client_name) throw new HttpError(400, 'Please select a client before finalizing the proposal.');
  if (!str(p.proposal_title, 255)) throw new HttpError(400, 'Please enter the proposal title before finalizing the proposal.');
  if (!p.proposal_date) throw new HttpError(400, 'Please enter the proposal date before finalizing the proposal.');
  if (!p.sections || p.sections.length === 0) throw new HttpError(400, 'Please add at least one section before finalizing the proposal.');

  const terms = p.sections.find((s) => s.section_type === 'TERMS');
  if (!terms) throw new HttpError(400, MSG_TERMS_MISSING);
  if (isHtmlEmpty(terms.terms?.content_snapshot)) throw new HttpError(400, MSG_TERMS_EMPTY);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const isPersistedId = (id, set) => id !== undefined && id !== null && /^\d+$/.test(String(id)) && set.has(Number(id));

function normaliseTableInput(table, label) {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  if (columns.length < 1) throw new HttpError(400, `${label}: a table needs at least one column.`);
  if (columns.length > MAX_COLUMNS) throw new HttpError(400, `${label}: a table can have at most ${MAX_COLUMNS} columns.`);
  if (rows.length > MAX_ROWS) throw new HttpError(400, `${label}: a table can have at most ${MAX_ROWS} rows.`);
  return { columns, rows };
}

async function saveTable(conn, sectionId, table, label) {
  const { columns, rows } = normaliseTableInput(table, label);

  const [oldCols] = await conn.query('SELECT id FROM proposal_table_columns WHERE section_id = ?', [sectionId]);
  const [oldRows] = await conn.query('SELECT id FROM proposal_table_rows WHERE section_id = ?', [sectionId]);
  const oldColSet = new Set(oldCols.map((c) => c.id));
  const oldRowSet = new Set(oldRows.map((r) => r.id));

  // --- columns ---
  const colIdMap = new Map(); // client id -> real id
  const keepCols = new Set();
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    const name = String(col.name ?? '').slice(0, 255);
    if (isPersistedId(col.id, oldColSet)) {
      await conn.query(
        'UPDATE proposal_table_columns SET column_name = ?, column_index = ?, sort_order = ? WHERE id = ?',
        [name, i + 1, i + 1, Number(col.id)]
      );
      colIdMap.set(String(col.id), Number(col.id));
      keepCols.add(Number(col.id));
    } else {
      const [r] = await conn.query(
        'INSERT INTO proposal_table_columns (section_id, column_index, column_name, sort_order) VALUES (?, ?, ?, ?)',
        [sectionId, i + 1, name, i + 1]
      );
      colIdMap.set(String(col.id), r.insertId);
      keepCols.add(r.insertId);
    }
  }
  const dropCols = [...oldColSet].filter((id) => !keepCols.has(id));
  if (dropCols.length) await conn.query('DELETE FROM proposal_table_columns WHERE id IN (?)', [dropCols]);

  // --- rows ---
  const keepRows = new Set();
  const rowIds = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (isPersistedId(row.id, oldRowSet)) {
      await conn.query('UPDATE proposal_table_rows SET row_index = ?, sort_order = ? WHERE id = ?', [i + 1, i + 1, Number(row.id)]);
      keepRows.add(Number(row.id));
      rowIds.push(Number(row.id));
    } else {
      const [r] = await conn.query('INSERT INTO proposal_table_rows (section_id, row_index, sort_order) VALUES (?, ?, ?)', [
        sectionId,
        i + 1,
        i + 1,
      ]);
      keepRows.add(r.insertId);
      rowIds.push(r.insertId);
    }
  }
  const dropRows = [...oldRowSet].filter((id) => !keepRows.has(id));
  if (dropRows.length) await conn.query('DELETE FROM proposal_table_rows WHERE id IN (?)', [dropRows]);

  // --- cells: one row per (row, column), rewritten ---
  await conn.query('DELETE FROM proposal_table_cells WHERE section_id = ?', [sectionId]);
  const cellValues = [];
  for (let r = 0; r < rows.length; r += 1) {
    const given = rows[r].cells || {};
    for (let c = 0; c < columns.length; c += 1) {
      const raw = given[columns[c].id];
      cellValues.push([sectionId, rowIds[r], colIdMap.get(String(columns[c].id)), raw === undefined || raw === null ? '' : String(raw).slice(0, 5000)]);
    }
  }
  if (cellValues.length) {
    await conn.query('INSERT INTO proposal_table_cells (section_id, row_id, column_id, cell_value) VALUES ?', [cellValues]);
  }

  // table configuration row
  await conn.query(
    `INSERT INTO proposal_section_tables (section_id, column_count, row_count) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE column_count = VALUES(column_count), row_count = VALUES(row_count)`,
    [sectionId, columns.length, rows.length]
  );
}

async function saveContent(conn, sectionId, html) {
  await conn.query(
    `INSERT INTO proposal_section_contents (section_id, content_html) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE content_html = VALUES(content_html)`,
    [sectionId, cleanHtml(html)]
  );
}

async function saveTerms(conn, sectionId, terms, { fillFromMaster }) {
  let masterId = null;
  if (terms && terms.terms_master_id !== undefined && terms.terms_master_id !== null && terms.terms_master_id !== '') {
    masterId = Number(terms.terms_master_id);
    if (!Number.isInteger(masterId)) throw new HttpError(400, 'Invalid Terms template.');
  }
  let snapshot = cleanHtml(terms?.content_snapshot);

  // The snapshot is a frozen copy. If a template is chosen but no text arrived,
  // copy the template's current text now (this is the "copy on save/finalize" rule).
  if (isHtmlEmpty(snapshot) && masterId && fillFromMaster) {
    const [m] = await conn.query('SELECT content FROM terms_master WHERE id = ?', [masterId]);
    if (m.length) snapshot = cleanHtml(m[0].content);
  }

  await conn.query(
    `INSERT INTO proposal_section_terms (section_id, terms_master_id, content_snapshot) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE terms_master_id = VALUES(terms_master_id), content_snapshot = VALUES(content_snapshot)`,
    [sectionId, masterId, snapshot]
  );
}

async function saveSections(conn, proposalId, sections, { fillTermsFromMaster = true } = {}) {
  if (!Array.isArray(sections)) throw new HttpError(400, 'sections must be a list.');
  if (sections.length > MAX_SECTIONS) throw new HttpError(400, `A proposal can have at most ${MAX_SECTIONS} sections.`);

  sections.forEach((s, i) => {
    if (!s || !SECTION_TYPES.includes(s.section_type)) {
      throw new HttpError(400, `Section ${i + 1}: type must be one of ${SECTION_TYPES.join(', ')}.`);
    }
  });
  if (sections.filter((s) => s.section_type === 'TERMS').length > 1) {
    throw new HttpError(400, 'Only one Terms & Conditions section is allowed per proposal.');
  }

  const [existing] = await conn.query('SELECT id, section_type FROM proposal_sections WHERE proposal_id = ?', [proposalId]);
  const existingMap = new Map(existing.map((s) => [s.id, s]));
  const existingSet = new Set(existingMap.keys());

  // Terms can never be removed once it exists.
  const hadTerms = existing.find((s) => s.section_type === 'TERMS');
  if (hadTerms && !sections.some((s) => isPersistedId(s.id, existingSet) && Number(s.id) === hadTerms.id)) {
    throw new HttpError(400, MSG_TERMS_MANDATORY);
  }

  // A saved section can't change its type.
  for (const s of sections) {
    if (isPersistedId(s.id, existingSet) && existingMap.get(Number(s.id)).section_type !== s.section_type) {
      throw new HttpError(400, 'A section cannot change its type after it is created.');
    }
  }

  // 1) delete sections the user removed (children go via ON DELETE CASCADE)
  const keep = new Set(sections.filter((s) => isPersistedId(s.id, existingSet)).map((s) => Number(s.id)));
  const drop = [...existingSet].filter((id) => !keep.has(id));
  if (drop.length) await conn.query('DELETE FROM proposal_sections WHERE id IN (?)', [drop]);

  // 2) upsert in the user's order; the array position IS sort_order
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    const title = String(s.title ?? '').slice(0, 255);
    const isMandatory = s.section_type === 'TERMS' ? 1 : 0;
    const label = `Section ${i + 1}${title ? ` (${title})` : ''}`;

    let sectionId;
    if (isPersistedId(s.id, existingSet)) {
      sectionId = Number(s.id);
      await conn.query('UPDATE proposal_sections SET title = ?, sort_order = ?, is_mandatory = ? WHERE id = ?', [
        title,
        i + 1,
        isMandatory,
        sectionId,
      ]);
    } else {
      const [r] = await conn.query(
        'INSERT INTO proposal_sections (proposal_id, section_type, title, sort_order, is_mandatory) VALUES (?, ?, ?, ?, ?)',
        [proposalId, s.section_type, title, i + 1, isMandatory]
      );
      sectionId = r.insertId;
    }

    if (s.section_type === 'CONTENT') await saveContent(conn, sectionId, s.content_html);
    else if (s.section_type === 'TABLE') await saveTable(conn, sectionId, s.table, label);
    else await saveTerms(conn, sectionId, s.terms, { fillFromMaster: fillTermsFromMaster });
  }
}

/** Header fields shared by create and update. */
async function readHeader(conn, body) {
  const proposalDate = str(body.proposal_date, 10);
  if (!isDate(proposalDate)) throw new HttpError(400, 'Proposal date must be in YYYY-MM-DD format.');
  const validTill = str(body.valid_till, 10);
  if (validTill && !isDate(validTill)) throw new HttpError(400, 'Valid-till date must be in YYYY-MM-DD format.');
  if (validTill && validTill < proposalDate) throw new HttpError(400, 'Valid-till date cannot be before the proposal date.');

  let clientId = null;
  let clientName = null;
  if (body.client_id !== undefined && body.client_id !== null && body.client_id !== '') {
    const [pk] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_KEY = 'PRI' LIMIT 1`
    );
    const [rows] = await conn.query(`SELECT * FROM clients WHERE \`${pk[0].COLUMN_NAME}\` = ?`, [body.client_id]);
    if (rows.length === 0) throw new HttpError(400, 'The selected client does not exist.');
    clientId = rows[0][pk[0].COLUMN_NAME];
    clientName = rows[0].business_name || rows[0].name || null;
  }

  return {
    client_id: clientId,
    client_name: clientName,
    proposal_title: String(body.proposal_title ?? '').trim().slice(0, 255),
    cover_tagline: str(body.cover_tagline, 255),
    proposal_date: proposalDate,
    valid_till: validTill,
  };
}

function buildNumber(financialYear, sequence) {
  return `RFZ/${financialYear}/${String(sequence).padStart(4, '0')}`;
}

module.exports = {
  // GET /api/proposals
  async getAll(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
      const offset = parseInt(req.query.offset, 10) || 0;
      const [rows] = await pool.query(
        `SELECT ${HEADER_COLUMNS}, (SELECT COUNT(*) FROM proposal_sections s WHERE s.proposal_id = p.id) AS section_count
           FROM proposals p ORDER BY p.id DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM proposals');
      res.json({
        success: true,
        data: rows.map((r) => ({ ...serializeHeader(r), section_count: num(r.section_count) })),
        total,
        limit,
        offset,
      });
    } catch (err) {
      handleError(res, err);
    }
  },

  // GET /api/proposals/next-number?date=2026-10-03   (preview only)
  async nextNumber(req, res) {
    try {
      const fy = getFinancialYear(req.query.date);
      const [rows] = await pool.query('SELECT last_sequence FROM proposal_sequences WHERE financial_year = ?', [fy]);
      const sequence = rows.length ? rows[0].last_sequence + 1 : 1;
      res.json({
        success: true,
        data: { proposal_number: buildNumber(fy, sequence), financial_year: fy, sequence_number: sequence },
      });
    } catch (err) {
      handleError(res, err);
    }
  },

  // GET /api/proposals/:id
  async getById(req, res) {
    try {
      const proposal = await loadProposal(pool, req.params.id);
      if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' });
      res.json({ success: true, data: proposal });
    } catch (err) {
      handleError(res, err);
    }
  },

  // POST /api/proposals
  async create(req, res) {
    const body = req.body || {};
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const header = await readHeader(conn, body);
      const fy = getFinancialYear(header.proposal_date);

      // reserve the next number for this financial year (row-locked)
      const [seq] = await conn.query('SELECT last_sequence FROM proposal_sequences WHERE financial_year = ? FOR UPDATE', [fy]);
      let sequence;
      if (seq.length) {
        sequence = seq[0].last_sequence + 1;
        await conn.query('UPDATE proposal_sequences SET last_sequence = ? WHERE financial_year = ?', [sequence, fy]);
      } else {
        sequence = 1;
        await conn.query('INSERT INTO proposal_sequences (financial_year, last_sequence) VALUES (?, ?)', [fy, sequence]);
      }

      const [result] = await conn.query(
        `INSERT INTO proposals
           (proposal_number, financial_year, sequence_number, client_id, client_name, proposal_title, cover_tagline,
            proposal_date, valid_till, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
        [
          buildNumber(fy, sequence),
          fy,
          sequence,
          header.client_id,
          header.client_name,
          header.proposal_title,
          header.cover_tagline,
          header.proposal_date,
          header.valid_till,
        ]
      );

      // Drafts are allowed without Terms; the text is frozen only when the snapshot is empty and a template is chosen.
      await saveSections(conn, result.insertId, body.sections || [], { fillTermsFromMaster: false });

      await conn.commit();
      const proposal = await loadProposal(pool, result.insertId);
      res.status(201).json({ success: true, data: proposal });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      handleError(res, err);
    } finally {
      if (conn) conn.release();
    }
  },

  // PUT /api/proposals/:id
  async update(req, res) {
    const body = req.body || {};
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [current] = await conn.query('SELECT id, status FROM proposals WHERE id = ? FOR UPDATE', [req.params.id]);
      if (current.length === 0) throw new HttpError(404, 'Proposal not found');

      const header = await readHeader(conn, body);
      await conn.query(
        `UPDATE proposals SET client_id = ?, client_name = ?, proposal_title = ?, cover_tagline = ?,
                proposal_date = ?, valid_till = ? WHERE id = ?`,
        [
          header.client_id,
          header.client_name,
          header.proposal_title,
          header.cover_tagline,
          header.proposal_date,
          header.valid_till,
          req.params.id,
        ]
      );

      await saveSections(conn, req.params.id, body.sections || [], { fillTermsFromMaster: current[0].status === 'FINALIZED' });

      // A finalized proposal must stay valid after every edit.
      if (current[0].status === 'FINALIZED') {
        const check = await loadProposal(conn, req.params.id);
        validateForFinalize(check);
      }

      await conn.commit();
      const proposal = await loadProposal(pool, req.params.id);
      res.json({ success: true, data: proposal });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      handleError(res, err);
    } finally {
      if (conn) conn.release();
    }
  },

  // POST /api/proposals/:id/finalize
  // Optionally accepts the same body as PUT so "Finalize" saves the latest edits and validates in ONE transaction.
  async finalize(req, res) {
    const body = req.body || {};
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [current] = await conn.query('SELECT id FROM proposals WHERE id = ? FOR UPDATE', [req.params.id]);
      if (current.length === 0) throw new HttpError(404, 'Proposal not found');

      if (body.sections) {
        const header = await readHeader(conn, body);
        await conn.query(
          `UPDATE proposals SET client_id = ?, client_name = ?, proposal_title = ?, cover_tagline = ?,
                  proposal_date = ?, valid_till = ? WHERE id = ?`,
          [
            header.client_id,
            header.client_name,
            header.proposal_title,
            header.cover_tagline,
            header.proposal_date,
            header.valid_till,
            req.params.id,
          ]
        );
        await saveSections(conn, req.params.id, body.sections, { fillTermsFromMaster: true });
      } else {
        // No edits sent: still freeze the template text if the snapshot is empty.
        const [t] = await conn.query(
          `SELECT pst.section_id, pst.terms_master_id, pst.content_snapshot
             FROM proposal_section_terms pst JOIN proposal_sections ps ON ps.id = pst.section_id
            WHERE ps.proposal_id = ?`,
          [req.params.id]
        );
        for (const row of t) {
          if (isHtmlEmpty(row.content_snapshot) && row.terms_master_id) {
            await saveTerms(conn, row.section_id, { terms_master_id: row.terms_master_id, content_snapshot: '' }, { fillFromMaster: true });
          }
        }
      }

      const proposal = await loadProposal(conn, req.params.id);
      validateForFinalize(proposal); // throws a 400 with the exact message, rolls everything back

      await conn.query("UPDATE proposals SET status = 'FINALIZED' WHERE id = ?", [req.params.id]);
      await conn.commit();

      res.json({ success: true, data: await loadProposal(pool, req.params.id) });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      handleError(res, err);
    } finally {
      if (conn) conn.release();
    }
  },

  // PATCH /api/proposals/:id/status   { status: 'DRAFT' }
  async updateStatus(req, res) {
    try {
      const status = req.body?.status;
      if (status !== 'DRAFT') {
        throw new HttpError(400, 'Only re-opening as DRAFT is allowed here. Use POST /:id/finalize to finalize.');
      }
      const [r] = await pool.query("UPDATE proposals SET status = 'DRAFT' WHERE id = ?", [req.params.id]);
      if (r.affectedRows === 0) throw new HttpError(404, 'Proposal not found');
      res.json({ success: true, data: await loadProposal(pool, req.params.id) });
    } catch (err) {
      handleError(res, err);
    }
  },

  // DELETE /api/proposals/:id
  async remove(req, res) {
    try {
      const [r] = await pool.query('DELETE FROM proposals WHERE id = ?', [req.params.id]);
      if (r.affectedRows === 0) throw new HttpError(404, 'Proposal not found');
      res.json({ success: true, message: 'Proposal deleted' });
    } catch (err) {
      handleError(res, err);
    }
  },
};
