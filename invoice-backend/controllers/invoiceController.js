// controllers/invoiceController.js
//
// Invoices are NOT handled by the generic CRUD controller because saving one
// touches several tables at once (invoices + invoice_items +
// invoice_item_milestones + invoice_sequences) and must be all-or-nothing.
//
//   GET   /api/invoices                 list (header rows, newest first)
//   GET   /api/invoices/next-number     preview of the next number (does NOT consume it)
//   GET   /api/invoices/:id             one invoice with items + milestones
//   POST  /api/invoices                 create (transaction)
//   PATCH /api/invoices/:id/status      mark PAID / PENDING

const pool = require('../config/db');
const { getTableColumns } = require('../utils/schemaUtils');
const {
  HttpError,
  INVOICE_TYPES,
  PAYMENT_STATUSES,
  getFinancialYear,
  startSequenceFor,
  buildInvoiceNumber,
  computeInvoice,
} = require('../utils/invoiceMath');

// DATE columns are formatted in SQL so the API returns "2026-09-28" and not a
// JS Date that shifts by the server's timezone. DECIMALs are converted to
// numbers in serialize() below (mysql2 returns them as strings).
const INVOICE_COLUMNS = `
  i.id, i.invoice_number, i.billing_location_id, i.financial_year, i.sequence_number,
  DATE_FORMAT(i.invoice_date, '%Y-%m-%d') AS invoice_date, i.invoice_type,
  i.client_id, i.client_name, i.client_contact, i.client_address, i.client_state,
  i.client_pan, i.client_gst_number,
  i.gross_amount, i.subtotal_amount, i.gst_percentage, i.gst_amount, i.total_amount,
  i.payment_status, i.payment_mode, i.payment_reference, i.amount_paid,
  DATE_FORMAT(i.payment_date, '%Y-%m-%d') AS payment_date, i.terms, i.show_bank_details,
  UNIX_TIMESTAMP(i.created_at) * 1000 AS created_at_ms,
  UNIX_TIMESTAMP(i.paid_at) * 1000 AS paid_at_ms`;

const num = (v) => (v === null || v === undefined ? null : Number(v));

function serializeInvoice(row, items) {
  const out = {
    id: row.id,
    invoice_number: row.invoice_number,
    billing_location_id: row.billing_location_id,
    financial_year: row.financial_year,
    sequence_number: row.sequence_number,
    invoice_date: row.invoice_date,
    invoice_type: row.invoice_type,
    client_id: row.client_id,
    client_name: row.client_name,
    client_contact: row.client_contact,
    client_address: row.client_address,
    client_state: row.client_state,
    client_pan: row.client_pan,
    client_gst_number: row.client_gst_number,
    gross_amount: num(row.gross_amount),
    subtotal_amount: num(row.subtotal_amount),
    gst_percentage: num(row.gst_percentage),
    gst_amount: num(row.gst_amount),
    total_amount: num(row.total_amount),
    payment_status: row.payment_status,
    payment_mode: row.payment_mode,
    payment_reference: row.payment_reference,
    payment_date: row.payment_date,
    amount_paid: num(row.amount_paid),
    terms: row.terms,
    show_bank_details: !!row.show_bank_details,
    created_at_ms: num(row.created_at_ms),
    paid_at_ms: num(row.paid_at_ms),
  };
  if (items) out.items = items;
  return out;
}

async function attachItems(conn, invoiceRows) {
  if (invoiceRows.length === 0) return [];
  const ids = invoiceRows.map((r) => r.id);

  const [itemRows] = await conn.query(
    `SELECT * FROM invoice_items WHERE invoice_id IN (?) ORDER BY invoice_id, line_no`,
    [ids]
  );
  const itemIds = itemRows.map((r) => r.id);
  const [msRows] = itemIds.length
    ? await conn.query(
        `SELECT * FROM invoice_item_milestones WHERE invoice_item_id IN (?) ORDER BY invoice_item_id, milestone_no`,
        [itemIds]
      )
    : [[]];

  const msByItem = {};
  msRows.forEach((m) => {
    (msByItem[m.invoice_item_id] = msByItem[m.invoice_item_id] || []).push({
      id: m.id,
      label: m.label,
      percent: num(m.percent),
      amount: num(m.amount),
      billed: !!m.is_billed,
    });
  });

  const itemsByInvoice = {};
  itemRows.forEach((it) => {
    (itemsByInvoice[it.invoice_id] = itemsByInvoice[it.invoice_id] || []).push({
      id: it.id,
      line_no: it.line_no,
      service_description: it.service_description,
      qty: num(it.qty),
      total_price: num(it.total_price),
      price_percentage: num(it.price_percentage),
      tax_rate: num(it.tax_rate),
      taxable_amount: num(it.taxable_amount),
      tax_amount: num(it.tax_amount),
      line_total: num(it.line_total),
      milestones: msByItem[it.id] || [],
    });
  });

  return invoiceRows.map((r) => serializeInvoice(r, itemsByInvoice[r.id] || []));
}

async function loadInvoice(conn, id) {
  const [rows] = await conn.query(`SELECT ${INVOICE_COLUMNS} FROM invoices i WHERE i.id = ?`, [id]);
  if (rows.length === 0) return null;
  const [full] = await attachItems(conn, rows);
  return full;
}

async function findLocation(conn, id) {
  if (id === undefined || id === null || id === '') throw new HttpError(400, 'Please select a billing location.');
  const { primaryKey } = await getTableColumns('billing_location');
  const [rows] = await conn.query(`SELECT * FROM \`billing_location\` WHERE \`${primaryKey}\` = ?`, [id]);
  if (rows.length === 0) {
    throw new HttpError(
      400,
      `Billing location ${id} does not exist in the billing_location table. ` +
        `The location list in the app must use ids that exist in the database.`
    );
  }
  return { row: rows[0], id: rows[0][primaryKey] };
}

// Whether a location is GST or not: the DB column wins if it exists,
// otherwise fall back to what the app says.
function resolveLocationType(row, fallback) {
  if (Object.prototype.hasOwnProperty.call(row, 'gst_applicable')) {
    const v = Buffer.isBuffer(row.gst_applicable) ? row.gst_applicable[0] : row.gst_applicable;
    return v ? 'GST' : 'NON_GST';
  }
  return fallback === 'GST' ? 'GST' : 'NON_GST';
}

function handleError(res, err) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      success: false,
      message: 'Invoice tables are missing in the database. Run "npm run migrate" in invoice-backend first.',
    });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'That invoice number was just taken — please save again.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ success: false, message: 'The selected client or billing location no longer exists.' });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
}

const str = (v, max) => {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s === '' ? null : s.slice(0, max);
};

module.exports = {
  // GET /api/invoices?limit=&offset=
  async getAll(req, res) {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
      const offset = parseInt(req.query.offset, 10) || 0;
      const [rows] = await pool.query(
        `SELECT ${INVOICE_COLUMNS} FROM invoices i ORDER BY i.id DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM invoices');
      res.json({ success: true, data: rows.map((r) => serializeInvoice(r)), total, limit, offset });
    } catch (err) {
      handleError(res, err);
    }
  },

  // GET /api/invoices/next-number?location_id=1&date=2026-09-28&location_type=GST
  // Preview only — the number is really handed out when the invoice is saved.
  async nextNumber(req, res) {
    try {
      const location = await findLocation(pool, req.query.location_id);
      const financialYear = getFinancialYear(req.query.date);
      const type = resolveLocationType(location.row, req.query.location_type);

      const [rows] = await pool.query(
        'SELECT last_sequence FROM invoice_sequences WHERE billing_location_id = ? AND financial_year = ?',
        [location.id, financialYear]
      );
      const sequence = rows.length ? rows[0].last_sequence + 1 : startSequenceFor(type);
      res.json({
        success: true,
        data: {
          invoice_number: buildInvoiceNumber(financialYear, sequence),
          financial_year: financialYear,
          sequence_number: sequence,
        },
      });
    } catch (err) {
      handleError(res, err);
    }
  },

  // GET /api/invoices/:id
  async getById(req, res) {
    try {
      const invoice = await loadInvoice(pool, req.params.id);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
      res.json({ success: true, data: invoice });
    } catch (err) {
      handleError(res, err);
    }
  },

  // POST /api/invoices
  async create(req, res) {
    const body = req.body || {};
    let conn;
    try {
      // ---- validate everything that doesn't need the database ----
      const invoiceType = body.invoice_type || 'DIRECT';
      if (!INVOICE_TYPES.includes(invoiceType)) {
        throw new HttpError(400, `Invoice type must be one of: ${INVOICE_TYPES.join(', ')}.`);
      }
      const financialYear = getFinancialYear(body.invoice_date);
      const clientName = str(body.client_name, 200);
      const clientContact = str(body.client_contact, 200);
      if (!clientName) throw new HttpError(400, 'Please enter the client name.');
      if (!clientContact) throw new HttpError(400, 'Please enter a contact person / phone.');
      const paymentStatus = body.payment_status || 'PENDING';
      if (!PAYMENT_STATUSES.includes(paymentStatus)) throw new HttpError(400, 'Invalid payment status.');

      conn = await pool.getConnection();
      await conn.beginTransaction();

      // ---- location + client must really exist ----
      const location = await findLocation(conn, body.billing_location_id);
      const locationType = resolveLocationType(location.row, body.location_type);
      const isGst = locationType === 'GST';

      let clientId = null;
      if (body.client_id !== undefined && body.client_id !== null && body.client_id !== '') {
        const { primaryKey } = await getTableColumns('clients');
        const [clientRows] = await conn.query(`SELECT \`${primaryKey}\` FROM \`clients\` WHERE \`${primaryKey}\` = ?`, [
          body.client_id,
        ]);
        if (clientRows.length === 0) {
          throw new HttpError(400, 'The selected client was not found in Client Master (it may have been deleted).');
        }
        clientId = clientRows[0][primaryKey];
      }

      // ---- totals are computed here, never taken from the browser ----
      const { items, totals } = computeInvoice(body.items, { invoiceType, isGst });

      // ---- next invoice number: atomic, and rolled back together with the invoice ----
      await conn.query(
        `INSERT INTO invoice_sequences (billing_location_id, financial_year, last_sequence)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1`,
        [location.id, financialYear, startSequenceFor(locationType)]
      );
      const [[seqRow]] = await conn.query(
        'SELECT last_sequence FROM invoice_sequences WHERE billing_location_id = ? AND financial_year = ?',
        [location.id, financialYear]
      );
      const sequence = seqRow.last_sequence;
      const invoiceNumber = buildInvoiceNumber(financialYear, sequence);

      const [invResult] = await conn.query(
        `INSERT INTO invoices
          (invoice_number, billing_location_id, financial_year, sequence_number, invoice_date, invoice_type,
           client_id, client_name, client_contact, client_address, client_state, client_pan, client_gst_number,
           gross_amount, subtotal_amount, gst_percentage, gst_amount, total_amount,
           payment_status, paid_at, payment_mode, terms, show_bank_details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNumber, location.id, financialYear, sequence, body.invoice_date, invoiceType,
          clientId, clientName, clientContact, str(body.client_address, 1000), str(body.client_state, 60),
          str(body.client_pan, 10), str(body.client_gst_number, 15),
          totals.gross_amount, totals.subtotal_amount, totals.gst_percentage, totals.gst_amount, totals.total_amount,
          paymentStatus, paymentStatus === 'PAID' ? new Date() : null,
          str(body.payment_mode, 20), str(body.terms, 5000), body.show_bank_details === false ? 0 : 1,
        ]
      );
      const invoiceId = invResult.insertId;

      for (const item of items) {
        const [itemResult] = await conn.query(
          `INSERT INTO invoice_items
            (invoice_id, line_no, service_description, qty, total_price, price_percentage,
             tax_rate, taxable_amount, tax_amount, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId, item.line_no, item.service_description.slice(0, 255), item.qty, item.total_price,
            item.price_percentage, item.tax_rate, item.taxable_amount, item.tax_amount, item.line_total,
          ]
        );
        for (const m of item.milestones) {
          await conn.query(
            `INSERT INTO invoice_item_milestones
              (invoice_item_id, milestone_no, label, percent, amount, is_billed)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [itemResult.insertId, m.milestone_no, m.label, m.percent, m.amount, m.is_billed ? 1 : 0]
          );
        }
      }

      await conn.commit();
      const saved = await loadInvoice(conn, invoiceId);
      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch {
          // connection already gone — nothing to roll back
        }
      }
      handleError(res, err);
    } finally {
      if (conn) conn.release();
    }
  },

  // PATCH /api/invoices/:id/status
  //   { payment_status: "PENDING" }
  //   { payment_status: "PAID", payment_mode, payment_reference, payment_date, amount_paid }
  // Marking an invoice PAID requires all four payment fields.
  async updateStatus(req, res) {
    try {
      const body = req.body || {};
      const status = body.payment_status;
      if (!PAYMENT_STATUSES.includes(status)) {
        throw new HttpError(400, `payment_status must be one of: ${PAYMENT_STATUSES.join(', ')}.`);
      }

      let sql;
      let params;
      if (status === 'PAID') {
        const mode = String(body.payment_mode || '').trim();
        const reference = String(body.payment_reference || '').trim();
        const date = String(body.payment_date || '').trim();
        const amount = Number(body.amount_paid);

        if (!mode) throw new HttpError(400, 'Payment Mode is required.');
        if (mode.length > 20) throw new HttpError(400, 'Payment Mode is too long.');
        if (!reference) throw new HttpError(400, 'Reference ID is required.');
        if (reference.length > 100) throw new HttpError(400, 'Reference ID cannot be longer than 100 characters.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
          throw new HttpError(400, 'Payment Date is required (YYYY-MM-DD).');
        }
        if (body.amount_paid === '' || body.amount_paid === null || body.amount_paid === undefined ||
            !Number.isFinite(amount) || amount <= 0) {
          throw new HttpError(400, 'Total Payment must be a number greater than 0.');
        }

        sql = `UPDATE invoices
               SET payment_status = 'PAID', paid_at = NOW(), payment_mode = ?,
                   payment_reference = ?, payment_date = ?, amount_paid = ?
               WHERE id = ?`;
        params = [mode, reference, date, Math.round(amount * 100) / 100, req.params.id];
      } else {
        // Back to pending: clear the payment details entered when it was paid.
        sql = `UPDATE invoices
               SET payment_status = 'PENDING', paid_at = NULL,
                   payment_reference = NULL, payment_date = NULL, amount_paid = NULL
               WHERE id = ?`;
        params = [req.params.id];
      }

      const [result] = await pool.query(sql, params);
      if (result.affectedRows === 0) throw new HttpError(404, 'Invoice not found');
      res.json({ success: true, data: await loadInvoice(pool, req.params.id) });
    } catch (err) {
      handleError(res, err);
    }
  },
};
