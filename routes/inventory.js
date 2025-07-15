// routes/inventory.js
const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/inventory-check', inventoryController.checkInventory);
router.post('/inventory-check', inventoryController.checkInventoryPost);
router.post('/inventory-search', inventoryController.searchProducts);
router.get('/inventory-by-skus', inventoryController.getInventoryBySKU);

module.exports = router;
