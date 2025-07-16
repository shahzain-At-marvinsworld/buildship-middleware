const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');


router.post('/inventory-check', inventoryController.checkInventory);
router.post('/search-by-name-or-booze', inventoryController.searchByNameOrBooze);
router.get('/inventory-by-skus', inventoryController.getInventoryBySKU);

module.exports = router;

