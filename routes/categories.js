var express = require('express');
var router = express.Router();

const categoriesController = require('../controllers/categories');

/* GET users listing. */
router.get('/get-categories', categoriesController.getCategories);

module.exports = router;
