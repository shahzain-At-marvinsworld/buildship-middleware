// controllers/inventoryController.js
const InventoryModel = require('../models/inventoryModel');


exports.checkInventory = async (req, res) => {
  try {
    const rawParam = req.query.extracted_inventory;
     const limit = parseInt(req.query.limit, 10) || 50;     // Default 50
    const offset = parseInt(req.query.offset, 10) || 0;    // Default 0

    if (!rawParam) {
      return res.status(400).json({ error: 'Missing extracted_inventory query param' });
    }

    const productArray = typeof rawParam === 'string'
      ? JSON.parse(rawParam)
      : rawParam;

    if (!Array.isArray(productArray)) {
      return res.status(400).json({ error: 'extracted_inventory must be an array of objects' });
    }

    const results = await InventoryModel.findInventoryByProductTypes(productArray, limit, offset);
    
    if (!results.length) {
      return res.status(404).json({ message: 'No matching inventory found.' });
    }

    res.json(results);
  } catch (err) {
    console.error('Inventory productType search error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getInventoryBySKU = async (req, res) => {
  try {
    const skus = req.query.skus
      ? JSON.parse(req.query.skus)
      : req.body.skus;

    if (!Array.isArray(skus)) {
      return res.status(400).json({ error: 'SKUs must be an array' });
    }

    const results = await InventoryModel.findInventoryBySKUs(skus);

     if (!results.length) {
      return res.status(404).json({ message: 'No matching inventory SKUs found.' });
    }

    res.json(results);
  } catch (err) {
    console.error('Inventory check error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};