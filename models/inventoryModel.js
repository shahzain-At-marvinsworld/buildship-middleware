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


exports.findInventoryByType = async (type, limit = 50, offset = 0) => {
  if (!type) return [];

    console.log("running SQL query for type", type);

  const sql = `
    SELECT * FROM inventory
    WHERE LOWER(name) LIKE ?
    ORDER BY updated_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  console.log("sql query being run for search---->", sql)

  // Use LIKE for a simple string match
  const [rows] = await db.execute(sql, [`%\\b${type.toLowerCase()}\\b%`, limit, offset]);
  return rows;
};

function parsePriceCondition(priceStr) {
  const match = priceStr.match(/under\s*\$\s*(\d+)/i);
  return match ? parseFloat(match[1]) : null;
}

exports.searchInventoryByCriteria = async (productList, limit = 10, offset = 0) => {
  let results = [];

  console.log('Starting inventory search...');
  console.log(`Total products to search: ${productList.length}`);

  for (const [index, product] of productList.entries()) {
    const { type, brand, price, size } = product;
    console.log(`\n Processing product [${index + 1}/${productList.length}]:`, product);

    if (!type) {
      console.warn(`Skipping product - missing "type" field.`);
      continue;
    }

    // STEP 1: Query only by type
    const regexPattern = `\\b${type}\\b`;
    console.log(`Querying inventory for type: '${type}' using regex: '${regexPattern}'`);

    const [initialRows] = await db.query(
      `SELECT * FROM inventory WHERE REGEXP_LIKE(name, ?, 'i') LIMIT ? OFFSET ?`,
      [regexPattern, limit, offset]
    );

    console.log(`Found ${initialRows.length} results for type '${type}'`);

    let filtered = initialRows;

    // STEP 2: Filter on brand
    if (brand && brand.toLowerCase() !== 'null') {
      const beforeBrand = filtered;
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(brand.toLowerCase())
      );

      console.log(`Brand filter: '${brand}' ${filtered.length} matches`);

      if (filtered.length === 0) {
        console.log(`Brand filter returned empty. Reverting to previous results.`);
        filtered = beforeBrand;
      }
    }

    // STEP 3: Filter on price
    const maxPrice = parsePriceCondition(price);
    if (maxPrice) {
      const beforePrice = filtered;
      filtered = filtered.filter(item =>
        parseFloat(item.rprice) < maxPrice
      );

      console.log(`Price filter: under $${maxPrice}  ${filtered.length} matches`);

      if (filtered.length === 0) {
        console.log(`Price filter returned empty. Reverting to previous results.`);
        filtered = beforePrice;
      }
    }

    // STEP 4: Filter on size
    if (size && size.toLowerCase() !== 'null') {
      const sizeInt = parseInt(size.replace(/[^\d]/g, ''));
      if (!isNaN(sizeInt)) {
        const beforeSize = filtered;
        filtered = filtered.filter(item => parseInt(item.ml) === sizeInt);

        console.log(`Size filter: ${sizeInt}ml ${filtered.length} matches`);

        if (filtered.length === 0) {
          console.log(`Size filter returned empty. Reverting to previous results.`);
          filtered = beforeSize;
        }
      } else {
        console.warn(`⚠️ Could not parse size: '${size}'`);
      }
    }

    results.push({ product, matches: filtered });
    console.log(`✅ Final matches for this product: ${filtered.length}`);
  }

  console.log(`\n🎯 Completed search for all products.\n`);
  return results;
};



exports.findInventoryBySKUs = async (skuArray) => {
  if (!skuArray.length) return [];

  const placeholders = skuArray.map(() => '?').join(', ');
  const sql = `SELECT * FROM inventory WHERE sku IN (${placeholders})`;

  const [rows] = await db.execute(sql, skuArray);
  return rows;
};
