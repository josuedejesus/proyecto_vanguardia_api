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
router.post('/get-items', productsController.getWarehouseItems);
router.post('/divide-batch', productsController.divideBatch);
router.post('/get-inventory', productsController.getInventory);
router.post('/get-product-passport', productsController.getProductHistory);


module.exports = router;
