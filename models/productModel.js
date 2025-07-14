// models/productModel.js
const db = require('../db');

//find by full-word productType match
// exports.findProductsByType = async (productType) => {
//   if (!productType) return [];

//   const sql = `
//     SELECT * FROM products
//     WHERE LOWER(productType) REGEXP ?
//   `;

//   const [rows] = await db.execute(sql, [`\\b${productType.toLowerCase()}\\b`]);
//   return rows;
// };

exports.findProductsByTypes = async (productTypes) => {
  if (!productTypes.length) return [];

  const conditions = [];
  const values = [];

  for (const type of productTypes) {
    if (typeof type === 'string' && type.trim()) {
      conditions.push(`LOWER(productType) REGEXP ?`);
      values.push(`\\b${type.toLowerCase()}\\b`);
    }
  }

  const whereClause = conditions.length ? conditions.join(' OR ') : '1=0';

  const sql = `
    SELECT * FROM products
    WHERE ${whereClause}
    ORDER BY updated_at DESC
  `;

  const [rows] = await db.execute(sql, values);
  return rows;
};


exports.findProductsBySKUs = async (skuArray) => {
  if (!skuArray.length) return [];

  const placeholders = skuArray.map(() => '?').join(', ');
  const sql = `SELECT * FROM products WHERE number_of_SKUs IN (${placeholders})`;

  const [rows] = await db.execute(sql, skuArray);
  return rows;
};
