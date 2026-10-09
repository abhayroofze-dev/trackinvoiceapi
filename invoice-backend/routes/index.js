// routes/index.js
//
// Maps each table in your rfzbilling_ database to a REST resource path.
// To expose a NEW table later, add one line here — the fields themselves
// are still pulled live from the database by genericController, you never
// need to list columns by hand.

const express = require('express');
const createCrudRouter = require('./genericRoutes');
const invoiceRoutes = require('./invoiceRoutes');

// Loaded defensively: if a dependency of the proposal module is missing (e.g. "npm install"
// was not run after adding sanitize-html), only /api/proposals reports it - invoices keep working.
let proposalRoutes;
try {
  proposalRoutes = require('./proposalRoutes');
} catch (err) {
  console.error(`\u26A0\uFE0F  Proposal module could not be loaded: ${err.message}\n   -> run "npm install" in invoice-backend and restart.`);
  proposalRoutes = express.Router().use((req, res) =>
    res.status(503).json({
      success: false,
      message: `Proposal module failed to load (${err.message}). Run "npm install" in invoice-backend and restart the server.`,
    })
  );
}

const router = express.Router();

router.use('/billing-locations', createCrudRouter('billing_location'));
router.use('/clients', createCrudRouter('clients'));
router.use('/financial-years', createCrudRouter('financial_year'));
router.use('/tax-master', createCrudRouter('tax_master'));

// Invoices have their own controller (multi-table transaction), see controllers/invoiceController.js
router.use('/invoices', invoiceRoutes);

// Proposals: dynamic block-based builder, see controllers/proposalController.js
router.use('/proposals', proposalRoutes);

// Terms & Conditions templates (plain CRUD - columns are read live from the table)
router.use('/terms-master', createCrudRouter('terms_master'));

module.exports = router;
