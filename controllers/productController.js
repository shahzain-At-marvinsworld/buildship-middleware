// controllers/productController.js
const ProductModel = require('../models/productModel');

// GET /api/products-by-type?products=["scotch","bourbon"]
exports.getProductsByType = async (req, res) => {
  try {
    const rawParam = req.query.products;

    if (!rawParam) {
      return res.status(400).json({ error: 'Missing "products" query parameter' });
    }
    console.log("query params received");
    console.log(rawParam);

    const productsArray = typeof rawParam === 'string'
      ? JSON.parse(rawParam)
      : rawParam;

    if (!Array.isArray(productsArray)) {
      return res.status(400).json({ error: '"products" must be an array of strings' });
    }

    console.log("products array extracted");
    console.log(productsArray);

    const results = await ProductModel.findProductsByTypes(productsArray);

    if (!results.length) {
      return res.status(404).json({ message: 'No matching product types found.' });
    }

    res.json(results);
  } catch (err) {
    console.error('Product type search error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.matchProducts = async (req, res) => {
  try {
    const skus = req.query.skus
      ? JSON.parse(req.query.skus)
      : req.body.skus;

    if (!Array.isArray(skus)) {
      return res.status(400).json({ error: 'SKUs must be an array' });
    }

    const results = await ProductModel.findProductsBySKUs(skus);

    if (!results.length) {
      return res.status(404).json({ message: 'No matching product types found.' });
    }
    
    res.json(results);
  } catch (err) {
    console.error('Product match error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
