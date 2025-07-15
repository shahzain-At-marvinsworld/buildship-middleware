// models/inventoryModel.js
const db = require('../db');

// exports.findInventoryByProductTypes = async (productTypes, limit = 50, offset = 0) => {
//   if (!productTypes.length) return [];

//   const conditions = [];
//   const values = [];

//   for (const type of productTypes) {
//     if (type.productType) {
//       conditions.push(`LOWER(name) REGEXP ?`);
//       values.push(`\\b${type.productType.toLowerCase()}\\b`);
//     }
//   }

//   const whereClause = conditions.length ? conditions.join(' OR ') : '1=0'; // fallback to no match
//     const sql = `
//     SELECT * FROM inventory
//     WHERE ${whereClause}
//     ORDER BY updated_at DESC
//     LIMIT ${limit}
//     OFFSET ${offset}
//   `;

//   const [rows] = await db.execute(sql, values);
//   return rows;
// };

// models/inventoryModel.js
exports.findInventoryByBrands = async (productList, limit = 50, offset = 0) => {
  if (!productList.length) return [];

  const conditions = [];
  const values = [];

  for (const item of productList) {
    const type = typeof item === 'string' ? item : item.type;
    if (type && typeof type === 'string') {
      conditions.push(`LOWER(name) REGEXP ?`);
      values.push(`\\b${type.toLowerCase()}\\b`);
    }
  }

  if (!conditions.length) return [];

  const whereClause = conditions.join(' OR ');
  const sql = `
    SELECT * FROM inventory
    WHERE ${whereClause}
    ORDER BY updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const [rows] = await db.execute(sql, values);
  return rows;
};


exports.findInventoryBySKUs = async (skuArray) => {
  if (!skuArray.length) return [];

  const placeholders = skuArray.map(() => '?').join(', ');
  const sql = `SELECT * FROM inventory WHERE sku IN (${placeholders})`;

  const [rows] = await db.execute(sql, skuArray);
  return rows;
};
