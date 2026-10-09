// routes/genericRoutes.js
// Builds a full REST router (GET list, GET one, POST, PUT, DELETE) for any table name.

const express = require('express');
const createCrudController = require('../controllers/genericController');

function createCrudRouter(tableName) {
  const router = express.Router();
  const controller = createCrudController(tableName);

  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

module.exports = createCrudRouter;
