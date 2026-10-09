// routes/proposalRoutes.js
const express = require('express');
const controller = require('../controllers/proposalController');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/next-number', controller.nextNumber); // must stay above '/:id'
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.post('/:id/finalize', controller.finalize);
router.patch('/:id/status', controller.updateStatus);
router.delete('/:id', controller.remove);

module.exports = router;
