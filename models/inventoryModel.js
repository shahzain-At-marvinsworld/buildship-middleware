const db = require("../db");

// models/inventoryModel.js
exports.findInventoryByBrands = async (productList, limit = 50, offset = 0) => {
  if (!productList.length) return [];

  const conditions = [];
  const values = [];

  for (const item of productList) {
    const type = typeof item === "string" ? item : item.type;
    if (type && typeof type === "string") {
      conditions.push(`LOWER(name) REGEXP ?`);
      values.push(`\\b${type.toLowerCase()}\\b`);
    }
  }

  if (!conditions.length) return [];

  const whereClause = conditions.join(" OR ");
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

function parsePriceCondition(priceStr) {
  const match = priceStr.match(/under\s*\$\s*(\d+)/i);
  return match ? parseFloat(match[1]) : null;
}

exports.searchInventoryByNameOrBooze = async (
  productList,
  limit = 10,
  offset = 0
) => {
  let results = [];

  console.log("Starting inventory search [name/booze-based]...");

  for (const [index, product] of productList.entries()) {
    const { name, booze, rprice, sname } = product;
    console.log(
      `\nProcessing product [${index + 1}/${productList.length}]:`,
      product
    );

    let baseQuery = "";
    let baseParams = [];

    // STEP 1: Determine search base
    if (name && name.trim() !== "") {
      baseQuery = `SELECT * FROM inventory WHERE LOWER(name) LIKE ? LIMIT ? OFFSET ?`;
      baseParams = [`%${name.toLowerCase()}%`, limit, offset];
      console.log(`Searching by name: '${name}'`);
    } else if (booze && booze.trim() !== "") {
      baseQuery = `SELECT * FROM inventory WHERE LOWER(booze) LIKE ? LIMIT ? OFFSET ?`;
      baseParams = [`%${booze.toLowerCase()}%`, limit, offset];
      console.log(`Searching by booze: '${booze}'`);
    } else {
      console.warn(`Skipping product [${index}] — no name or booze key.`);
      continue;
    }

    const [initialRows] = await db.query(baseQuery, baseParams);
    console.log(`Found ${initialRows.length} initial rows`);

    let filtered = initialRows;

    // STEP 2: Filter on price
    const maxPrice = parsePriceCondition(rprice);
    if (maxPrice) {
      const beforePrice = filtered;
      filtered = filtered.filter((item) => parseFloat(item.rprice) < maxPrice);
      console.log(
        `Filter: rprice under $${maxPrice}  ${filtered.length} matches`
      );
      if (filtered.length === 0) {
        console.log("Price filter returned empty. Reverting.");
        filtered = beforePrice;
      }
    }

    // STEP 3: Filter on sname
    if (sname && sname.toLowerCase() !== "null") {
      const beforeSize = filtered;
      filtered = filtered.filter(
        (item) => item.sname.toLowerCase() === sname.toLowerCase()
      );
      console.log(`Filter: sname = '${sname}' ${filtered.length} matches`);
      if (filtered.length === 0) {
        console.log("Size filter returned empty. Reverting.");
        filtered = beforeSize;
      }
    }

    results.push({ product, matches: filtered });
    console.log(`Final matches for product: ${filtered.length}`);
  }

  console.log(`\nCompleted search for all products.\n`);
  return results;
};

exports.findInventoryBySKUs = async (skuArray) => {
  if (!skuArray.length) return [];

  const placeholders = skuArray.map(() => "?").join(", ");
  const sql = `SELECT * FROM inventory WHERE sku IN (${placeholders})`;

  const [rows] = await db.execute(sql, skuArray);
  return rows;
};