const InventoryModel = require("../models/inventoryModel");

// Helper function to convert price string into a range
function convertPriceToRange(priceString) {
  const pricePattern =
    /^(under|below|above|greater|less)?\s*\$?(\d+)(?:\s*(and|to)\s*\$?(\d+))?/i;
  const match = priceString.match(pricePattern);

  if (!match) return null; // Invalid price format

  const operator =
    match[1]?.toLowerCase() === "under" || match[1]?.toLowerCase() === "below"
      ? "<"
      : ">";
  const lowerPrice = parseFloat(match[2]);
  const upperPrice = match[4] ? parseFloat(match[4]) : null;

  return { operator, lowerPrice, upperPrice };
}

exports.checkInventory = async (req, res) => {
  try {
    console.log("Req body received:", req.body);

    const productArray = req.body.product_list;
    const limit = parseInt(req.body.limit, 10) || 50;
    const offset = parseInt(req.body.offset, 10) || 0;

    if (!Array.isArray(productArray) || !productArray.length) {
      return res
        .status(400)
        .json({ error: "product_list must be a non-empty array of objects" });
    }

    console.log("POST body product_list:", productArray);

    const results = await InventoryModel.findInventoryByBrands(
      productArray,
      limit,
      offset
    );

    if (!results.length) {
      return res.status(404).json({ message: "No matching inventory found." });
    }

    res.json(results);
  } catch (err) {
    console.error("Inventory POST brand search error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.searchByNameOrBooze = async (req, res) => {
  try {
    const { product_list, limit = 10, offset = 0 } = req.body;

    if (!Array.isArray(product_list)) {
      return res.status(400).json({ error: "product_list must be an array" });
    }

    const data = await InventoryModel.searchInventoryByNameOrBooze(
      product_list,
      limit,
      offset
    );
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in name/booze search:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

exports.searchDynamic = async (req, res) => {
  const start = Date.now();
  try {
    const { product_list, limit = 10, offset = 0 } = req.body;

    if (!Array.isArray(product_list)) {
      return res.status(400).json({ error: "product_list must be an array" });
    }

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    console.log(`📦 Incoming search for ${product_list.length} products`);
    console.log(`🔁 Pagination: limit=${parsedLimit}, offset=${parsedOffset}`);

    const data = await InventoryModel.searchInventoryDynamic(
      product_list,
      parsedLimit,
      parsedOffset
    );

    const duration = Date.now() - start;
    console.log(`✅ Search complete in ${duration}ms`);

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("❌ Error in name/booze search:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};


exports.getInventoryBySKU = async (req, res) => {
  try {
    const skus = req.query.skus ? JSON.parse(req.query.skus) : req.body.skus;

    if (!Array.isArray(skus)) {
      return res.status(400).json({ error: "SKUs must be an array" });
    }

    const results = await InventoryModel.findInventoryBySKUs(skus);

    if (!results.length) {
      return res
        .status(404)
        .json({ message: "No matching inventory SKUs found." });
    }

    res.json(results);
  } catch (err) {
    console.error("Inventory check error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
