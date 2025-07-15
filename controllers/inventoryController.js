// controllers/inventoryController.js
const InventoryModel = require('../models/inventoryModel');


// exports.checkInventory = async (req, res) => {
//   try {
//     const rawParam = req.query.extracted_inventory;
//      const limit = parseInt(req.query.limit, 10) || 50;     // Default 50
//     const offset = parseInt(req.query.offset, 10) || 0;    // Default 0

//     if (!rawParam) {
//       return res.status(400).json({ error: 'Missing extracted_inventory query param' });
//     }

//     const productArray = typeof rawParam === 'string'
//       ? JSON.parse(rawParam)
//       : rawParam;

//     if (!Array.isArray(productArray)) {
//       return res.status(400).json({ error: 'extracted_inventory must be an array of objects' });
//     }

//     const results = await InventoryModel.findInventoryByProductTypes(productArray, limit, offset);
    
//     if (!results.length) {
//       return res.status(404).json({ message: 'No matching inventory found.' });
//     }

//     res.json(results);
//   } catch (err) {
//     console.error('Inventory productType search error:', err);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// };

// controllers/inventoryController.js
exports.checkInventory = async (req, res) => {
  try {
    const rawParam = req.query.product_list;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    if (!rawParam) {
      return res.status(400).json({ error: 'Missing product_list query param' });
    }

    console.log('🔍 Raw param:', rawParam);

    let productArray;

    if (typeof rawParam === 'string') {
      // Handle Postman-style or Buildship stringified JSON
      try {
        const parsed = JSON.parse(rawParam);
        productArray = Array.isArray(parsed)
          ? parsed
          : [parsed];
      } catch {
        // Fallback: comma-delimited brand strings
        productArray = rawParam.split(',').map(brand => ({ brand: brand.trim() }));
      }
    } else if (Array.isArray(rawParam)) {
      // 🛠️ Check for Buildship-style `[object Object]`
      if (rawParam.every(item => typeof item === 'string' && item.includes('[object Object]'))) {
        return res.status(400).json({ error: 'Malformed array. Did you send raw objects as strings?' });
      }
      productArray = rawParam;
    } else if (typeof rawParam === 'object') {
      // Possibly already parsed (rare case)
      productArray = [rawParam];
    } else {
      return res.status(400).json({ error: 'Unrecognized product_list format' });
    }

    console.log('📦 Normalized array:', productArray);

    if (!Array.isArray(productArray)) {
      return res.status(400).json({ error: 'product_list must be an array of objects' });
    }

    const results = await InventoryModel.findInventoryByBrands(productArray, limit, offset);

    if (!results.length) {
      return res.status(404).json({ message: 'No matching inventory found.' });
    }

    res.json(results);
  } catch (err) {
    console.error('❌ Inventory brand search error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// controllers/inventoryController.js
exports.checkInventoryPost = async (req, res) => {
  try {
    console.log('🔍 Req body received:', req.body);
    
    const productArray = req.body.product_list;
    const limit = parseInt(req.body.limit, 10) || 50;
    const offset = parseInt(req.body.offset, 10) || 0;

    if (!Array.isArray(productArray) || !productArray.length) {
      return res.status(400).json({ error: 'product_list must be a non-empty array of objects' });
    }

    console.log('📦 POST body product_list:', productArray);

    const results = await InventoryModel.findInventoryByBrands(productArray, limit, offset);

    if (!results.length) {
      return res.status(404).json({ message: 'No matching inventory found.' });
    }

    res.json(results);
  } catch (err) {
    console.error('❌ Inventory POST brand search error:', err);
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
}