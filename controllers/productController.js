// controllers/productController.js
const ProductModel = require('../models/productModel');

//GET /api/products-by-type?product=GIN
exports.getProductsByType = async (req, res) => {
  try {
    const product = req.query.product;

    if (!product || typeof product !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "product" query parameter' });
    }

    const results = await ProductModel.findProductsByType(product);

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
