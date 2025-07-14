// models/productModel.js
const db = require('../db');

//find by full-word productType match
exports.findProductsByType = async (productType) => {
  if (!productType) return [];

  const sql = `
    SELECT * FROM products
    WHERE LOWER(productType) REGEXP ?
  `;

  const [rows] = await db.execute(sql, [`\\b${productType.toLowerCase()}\\b`]);
  return rows;
};


exports.findProductsBySKUs = async (skuArray) => {
  if (!skuArray.length) return [];

  const placeholders = skuArray.map(() => '?').join(', ');
  const sql = `SELECT * FROM products WHERE number_of_SKUs IN (${placeholders})`;

  const [rows] = await db.execute(sql, skuArray);
  return rows;
};
