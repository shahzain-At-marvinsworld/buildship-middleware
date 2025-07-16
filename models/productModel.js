const db = require("../db");

exports.findProductsByTypes = async (productTypes) => {
  if (!productTypes.length) return [];

  const conditions = [];
  const values = [];

  for (const type of productTypes) {
    if (typeof type === "string" && type.trim()) {
      conditions.push(`LOWER(productType) REGEXP ?`);
      values.push(`\\b${type.toLowerCase()}\\b`);
    }
  }

  const whereClause = conditions.length ? conditions.join(" OR ") : "1=0";

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

  const placeholders = skuArray.map(() => "?").join(", ");
  const sql = `SELECT * FROM products WHERE number_of_SKUs IN (${placeholders})`;

  const [rows] = await db.execute(sql, skuArray);
  return rows;
};