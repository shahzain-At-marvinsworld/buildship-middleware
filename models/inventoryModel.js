const db = require("../db");
const { parsePriceConditionBasic, parsePriceConditionAdvance } = require("../utils/priceUtils");

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
    const maxPrice = parsePriceConditionBasic(rprice);
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


exports.searchInventoryDynamic = async (productList, limit = 10, offset = 0) => {
  let results = [];

  console.log("Starting dynamic inventory search...");

  for (const [index, product] of productList.entries()) {
    console.log(`\nProcessing product [${index + 1}/${productList.length}]:`, product);

    // Extract search-relevant fields
    const {
      name,
      booze,
      type,
      region,
      state,
      city,
      common_names: commonNames,
      rprice,
      sname,
      aging,
      appearance,
      aroma_flavor,
      acidity_sweetness,
      serving_style,
      food_pairings,
    } = product;

    // STEP 1: Build dynamic SQL WHERE clause
    let conditions = [];
    let params = [];

    if (name) {
      conditions.push(`LOWER(name) LIKE ?`);
      params.push(`%${name.toLowerCase()}%`);
    }
    if (booze) {
      conditions.push(`LOWER(booze) LIKE ?`);
      params.push(`%${booze.toLowerCase()}%`);
    }
    if (type) {
      conditions.push(`LOWER(type) LIKE ?`);
      params.push(`%${type.toLowerCase()}%`);
    }
    if (region) {
      conditions.push(`LOWER(region) LIKE ?`);
      params.push(`%${region.toLowerCase()}%`);
    }
    if (state) {
      conditions.push(`LOWER(state) LIKE ?`);
      params.push(`%${state.toLowerCase()}%`);
    }
    if (city) {
      conditions.push(`LOWER(city) LIKE ?`);
      params.push(`%${city.toLowerCase()}%`);
    }
    if (commonNames) {
      conditions.push(`LOWER(common_names) LIKE ?`);
      params.push(`%${commonNames.toLowerCase()}%`);
    }

    let query = `SELECT * FROM inventory`;
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    console.log(`Running query: ${query}`);
    console.log(`With params: ${params}`);

    const [initialRows] = await db.query(query, params);
    console.log(`Found ${initialRows.length} rows`);

    let filtered = [...initialRows];

    // STEP 2: Post-query filters
    const maxPrice = parsePriceConditionAdvance(rprice);
    if (maxPrice) {
      const before = filtered;
      filtered = filtered.filter((item) => parseFloat(item.rprice) < maxPrice);
      console.log(`Price filter < $${maxPrice}: ${filtered.length} matched`);
      if (filtered.length === 0) filtered = before;
    }

    if (sname && sname.toLowerCase() !== 'null') {
      const before = filtered;
      filtered = filtered.filter((item) =>
        item.sname?.toLowerCase() === sname.toLowerCase()
      );
      console.log(`Size filter: ${filtered.length} matched`);
      if (filtered.length === 0) filtered = before;
    }

    const softFilter = (field, expected) => {
      if (!expected || !field) return true;
      return field.toLowerCase().includes(expected.toLowerCase());
    };

    const beforeDescriptors = filtered;
    filtered = filtered.filter((item) =>
      softFilter(item.aging, aging) &&
      softFilter(item.appearance, appearance) &&
      softFilter(item.aroma_flavor, aroma_flavor) &&
      softFilter(item.acidity_sweetness, acidity_sweetness) &&
      softFilter(item.serving_style, serving_style) &&
      softFilter(item.food_pairings, food_pairings)
    );

    console.log(`Descriptor filters: ${filtered.length} matched`);
    if (filtered.length === 0) filtered = beforeDescriptors;

    results.push({ product, matches: filtered });
    console.log(`Final matches for product: ${filtered.length}`);
  }

  console.log(`\n✅ Completed full product search.\n`);
  return results;
};


exports.findInventoryBySKUs = async (skuArray) => {
  if (!skuArray.length) return [];

  const placeholders = skuArray.map(() => "?").join(", ");
  const sql = `SELECT * FROM inventory WHERE sku IN (${placeholders})`;

  const [rows] = await db.execute(sql, skuArray);
  return rows;
};