const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/product-match', productController.matchProducts);
router.get('/products-by-type', productController.getProductsByType);

module.exports = router;