// controllers/genericController.js
//
// One controller factory used by every table (billing_location, clients,
// financial_year, tax_master, and any table you add later). It never
// hardcodes a column name — it reads the request body / query and only
// ever touches columns that getTableColumns() confirms actually exist,
// so it's also safe against SQL injection through column names.

const pool = require('../config/db');
const { getTableColumns } = require('../utils/schemaUtils');

// Any key the frontend sends that doesn't match a real column is silently
// skipped further down (that's how the API stays generic) — which is
// exactly how the client "state" field went missing for a long time with
// no error anywhere. This just makes that situation visible in the server
// console instead of invisible, without changing the API's behavior or
// response shape.
function warnAboutUnknownFields(tableName, body, columns) {
  const unknown = Object.keys(body).filter((k) => !columns.includes(k));
  if (unknown.length > 0) {
    console.warn(
      `[${tableName}] Ignored field(s) not found as columns in the database table: ${unknown.join(', ')}. ` +
        `These values were NOT saved. Add matching column(s) in Workbench if they should be.`
    );
  }
}

function createCrudController(tableName) {
  return {
    // GET /api/<resource>?limit=&offset=
    async getAll(req, res) {
      try {
        await getTableColumns(tableName); // ensures table exists, throws a clean error otherwise
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
        const offset = parseInt(req.query.offset, 10) || 0;

        const [rows] = await pool.query(
          `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
          [limit, offset]
        );
        const [countRows] = await pool.query(
          `SELECT COUNT(*) AS total FROM \`${tableName}\``
        );

        res.json({
          success: true,
          data: rows,
          total: countRows[0].total,
          limit,
          offset,
        });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    // GET /api/<resource>/:id
    async getById(req, res) {
      try {
        const { primaryKey } = await getTableColumns(tableName);
        const [rows] = await pool.query(
          `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`,
          [req.params.id]
        );
        if (rows.length === 0) {
          return res
            .status(404)
            .json({ success: false, message: `Record not found in ${tableName}` });
        }
        res.json({ success: true, data: rows[0] });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    // POST /api/<resource>
    async create(req, res) {
      try {
        const { columns, autoIncrement } = await getTableColumns(tableName);
        const body = req.body || {};

        const insertable = columns.filter(
          (c) =>
            c !== autoIncrement &&
            c !== 'created_at' &&
            c !== 'updated_at' &&
            body[c] !== undefined
        );

        warnAboutUnknownFields(tableName, body, columns);

        if (insertable.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: 'No valid fields provided in request body' });
        }

        const values = insertable.map((c) => body[c]);
        const placeholders = insertable.map(() => '?').join(', ');
        const colList = insertable.map((c) => `\`${c}\``).join(', ');

        const [result] = await pool.query(
          `INSERT INTO \`${tableName}\` (${colList}) VALUES (${placeholders})`,
          values
        );

        const { primaryKey } = await getTableColumns(tableName);
        const [rows] = await pool.query(
          `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`,
          [result.insertId || body[primaryKey]]
        );

        res.status(201).json({ success: true, data: rows[0] });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    // PUT /api/<resource>/:id
    async update(req, res) {
      try {
        const { columns, primaryKey, autoIncrement } = await getTableColumns(tableName);
        const body = req.body || {};

        const updatable = columns.filter(
          (c) =>
            c !== autoIncrement &&
            c !== primaryKey &&
            c !== 'created_at' &&
            body[c] !== undefined
        );

        warnAboutUnknownFields(tableName, body, columns);

        if (updatable.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: 'No valid fields provided in request body' });
        }

        const setClause = updatable.map((c) => `\`${c}\` = ?`).join(', ');
        const values = updatable.map((c) => body[c]);
        values.push(req.params.id);

        const [result] = await pool.query(
          `UPDATE \`${tableName}\` SET ${setClause} WHERE \`${primaryKey}\` = ?`,
          values
        );

        if (result.affectedRows === 0) {
          return res
            .status(404)
            .json({ success: false, message: `Record not found in ${tableName}` });
        }

        const [rows] = await pool.query(
          `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`,
          [req.params.id]
        );

        res.json({ success: true, data: rows[0] });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },

    // DELETE /api/<resource>/:id
    async remove(req, res) {
      try {
        const { primaryKey } = await getTableColumns(tableName);
        const [result] = await pool.query(
          `DELETE FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`,
          [req.params.id]
        );
        if (result.affectedRows === 0) {
          return res
            .status(404)
            .json({ success: false, message: `Record not found in ${tableName}` });
        }
        res.json({ success: true, message: `Record deleted from ${tableName}` });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    },
  };
}

module.exports = createCrudController;
