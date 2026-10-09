// utils/schemaUtils.js
//
// This is the core of "fields automatically come from the database".
// Instead of hardcoding field names for every table, we ask MySQL's
// INFORMATION_SCHEMA what columns a table actually has, and cache the
// result. Every controller then builds its INSERT/UPDATE/SELECT
// dynamically from this list. Add or change a column in Workbench,
// restart the server (or wait for cache to be cleared), and the API
// picks it up automatically — no code change needed.

const pool = require('../config/db');

const schemaCache = {};

async function getTableColumns(tableName) {
  if (schemaCache[tableName]) return schemaCache[tableName];

  const [rows] = await pool.query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName]
  );

  if (rows.length === 0) {
    throw new Error(`Table "${tableName}" not found in the connected database.`);
  }

  const columns = rows.map((r) => r.COLUMN_NAME);
  const primaryKeyRow = rows.find((r) => r.COLUMN_KEY === 'PRI');
  const autoIncrementRow = rows.find((r) => r.EXTRA && r.EXTRA.includes('auto_increment'));

  const meta = {
    columns,
    primaryKey: primaryKeyRow ? primaryKeyRow.COLUMN_NAME : 'id',
    autoIncrement: autoIncrementRow ? autoIncrementRow.COLUMN_NAME : null,
    raw: rows,
  };

  schemaCache[tableName] = meta;
  return meta;
}

// Call this if you alter a table's structure while the server is running
// and don't want to restart it.
function clearSchemaCache(tableName) {
  if (tableName) {
    delete schemaCache[tableName];
  } else {
    Object.keys(schemaCache).forEach((k) => delete schemaCache[k]);
  }
}

module.exports = { getTableColumns, clearSchemaCache };
