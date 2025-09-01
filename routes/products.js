var express = require('express');
var router = express.Router();

const productsController = require('../controllers/products');

/* GET users listing. */
router.get('/get-products', productsController.getProducts);
router.post('/register-product-entry', productsController.registerProductEntry);
router.post('/create-product', productsController.createProduct);
router.get('/get-batch-types', productsController.getBatchTypes);
router.post('/create-batch-type', productsController.createBatchType);
router.post('/move-item', productsController.moveItem);

module.exports = router;
