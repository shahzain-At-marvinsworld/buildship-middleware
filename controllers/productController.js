const ProductModel = require("../models/productModel");

// GET /api/products-by-type?products=["scotch","bourbon"]
exports.getProductsByType = async (req, res) => {
  try {
    const rawParam = req.query.products;

    if (!rawParam) {
      return res
        .status(400)
        .json({ error: 'Missing "products" query parameter' });
    }
    console.log("🔍 Raw param:", rawParam);

    let productsArray;

    if (Array.isArray(rawParam)) {
      productsArray = rawParam; // e.g. ?products=scotch&products=bourbon
    } else if (typeof rawParam === "string") {
      if (rawParam.trim().startsWith("[")) {
        productsArray = JSON.parse(rawParam); // JSON array
      } else {
        productsArray = rawParam.split(",").map((p) => p.trim()); // Comma-separated
      }
    } else {
      return res.status(400).json({
        error: '"products" must be an array or comma-separated string',
      });
    }

    console.log("Normalized array:", productsArray);

    if (!Array.isArray(productsArray)) {
      return res
        .status(400)
        .json({ error: '"products" must be an array of strings' });
    }

    const results = await ProductModel.findProductsByTypes(productsArray);

    if (!results.length) {
      return res
        .status(404)
        .json({ message: "No matching product types found." });
    }

    res.json(results);
  } catch (err) {
    console.error("Product type search error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.matchProducts = async (req, res) => {
  try {
    const skus = req.query.skus ? JSON.parse(req.query.skus) : req.body.skus;

    if (!Array.isArray(skus)) {
      return res.status(400).json({ error: "SKUs must be an array" });
    }

    const results = await ProductModel.findProductsBySKUs(skus);

    if (!results.length) {
      return res
        .status(404)
        .json({ message: "No matching product types found." });
    }

    res.json(results);
  } catch (err) {
    console.error("Product match error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
