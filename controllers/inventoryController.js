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
// Helper function to convert price string into a range
function convertPriceToRange(priceString) {
  const pricePattern = /^(under|below|above|greater|less)?\s*\$?(\d+)(?:\s*(and|to)\s*\$?(\d+))?/i;
  const match = priceString.match(pricePattern);

  if (!match) return null; // Invalid price format

  const operator = match[1]?.toLowerCase() === 'under' || match[1]?.toLowerCase() === 'below' ? '<' : '>';
  const lowerPrice = parseFloat(match[2]);
  const upperPrice = match[4] ? parseFloat(match[4]) : null;

  return { operator, lowerPrice, upperPrice };
}

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


exports.searchInventoryPost = async (req, res) => {
  try {
    const { product_list, limit = 50, offset = 0 } = req.body;

    if (!Array.isArray(product_list) || !product_list.length) {
      return res.status(400).json({ error: 'product_list must be a non-empty array of objects' });
    }

    const results = [];

    // Loop through each object in the product_list
    for (const item of product_list) {
      let { brand, type, price, size } = item;

      // Step 1: Search by product type
      let searchResults = await InventoryModel.findInventoryByType(type, limit, offset);

    console.log("search results returned from the model method ---------------------->", searchResults);


      // Step 2: Filter based on price if provided
      if (price) {
        const priceRange = convertPriceToRange(price);
        if (priceRange) {
          searchResults = searchResults.filter((product) => {
            const productPrice = product.rprice;

            if (priceRange.upperPrice) {
              return priceRange.operator === '<'
                ? productPrice < priceRange.lowerPrice
                : productPrice > priceRange.lowerPrice;
            } else {
              return priceRange.operator === '<'
                ? productPrice < priceRange.lowerPrice
                : productPrice > priceRange.lowerPrice;
            }
          });
        } else {
          return res.status(400).json({ error: 'Invalid price format' });
        }
      }

      // Step 3: Filter based on other fields (brand, size) if they are present
      searchResults = searchResults.filter((product) => {
        let isMatch = true;

        // Check if the product name contains the brand (case-insensitive match)
        if (brand && !product.name.toLowerCase().includes(brand.toLowerCase())) {
          isMatch = false;
        }

        // Check if the size matches (if provided)
        if (size && (product.sname.toLowerCase() !== size.toLowerCase())) {
          isMatch = false;
        }

        return isMatch;
      });

      // Push the filtered results for this specific object
      if (searchResults.length) {
        results.push({ product: item, matches: searchResults });
      }
    }

    if (!results.length) {
      return res.status(404).json({ message: 'No matching inventory found.' });
    }

    res.json(results);
  } catch (err) {
    console.error('❌ Inventory brand search error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const { product_list, limit = 10, offset = 0 } = req.body;

    if (!Array.isArray(product_list)) {
      return res.status(400).json({ error: 'product_list must be an array' });
    }

    const data = await InventoryModel.searchInventoryByCriteria(product_list, limit, offset);
    res.json({ success: true, data });

  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
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