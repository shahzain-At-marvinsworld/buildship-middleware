require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../db");
const OpenAI = require("openai");

const openai = new OpenAI();

const OUTPUT_FILE = path.join(__dirname, "enrichment_test_results.jsonl");
const ERROR_FILE = path.join(__dirname, "enrichment_invalid_results.jsonl");

// Configurable safety margin
const REQUEST_THRESHOLD = 10; // Pause if remaining requests ≤ this
const TOKEN_THRESHOLD = 5000; // Optional: Pause if tokens remaining ≤ this

async function fetchBatch(limit, offset) {
  const [rows] = await db.execute(
    `SELECT id, name 
     FROM inventory
     WHERE type IS NULL OR type = ''
     LIMIT ${limit} OFFSET ${offset}`
  );
  return rows;
}

async function getTotalPendingRows() {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total FROM inventory WHERE type IS NULL OR type = ''`
  );
  return rows[0].total;
}

async function enrichRow(row) {
  const prompt = `
You are a beverage and liquor expert specializing in U.S. drinks.

Given the name of a drink, respond with a JSON object containing exactly these fields:
"type", "region", "state", "city", "aging", "appearance", "aroma_flavor", "acidity_sweetness", "serving_style", "food_pairings", "common_names".

Rules:
- Respond ONLY with JSON, no explanations.
- Use null for unknown values.
- If the drink is from the U.S.:
  - "region" should be a broad U.S. area (e.g., Midwest, Southwest, Pacific Northwest).
  - "state" must be a U.S. state (if identifiable).
  - "city" must be a U.S. city (if identifiable).
- If the drink is from outside the U.S.:
  - "region" should be a broad valid area within that country or the country itself if identifiable (e.g., Kansai in Japan, Bordeaux in France).
  - "state" (or equivalent) should be the correct administrative division if identifiable (e.g., Hyōgo Prefecture, Burgundy) (if identifiable).
  - "city" should be the city if identifiable (e.g., Kobe, Reims).
- Keep descriptions short (max 15 words each).
- "food_pairings" can be a comma-separated string.wo
- "common_names" can be a comma-separated string.
- Do NOT use triple backticks or any code fences.
- Do NOT include "json" before the JSON.

The drink name is: "${row.name}"
`;

  try {
    const { data: completion, response } = await openai.chat.completions
      .create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      })
      .withResponse();

    // ===== Log Rate Limit Info =====
    const remainingRequests = parseInt(
      response.headers.get("x-ratelimit-remaining-requests"),
      10
    );
    const resetRequestsSec =
      parseFloat(
        response.headers
          .get("x-ratelimit-reset-requests")
          ?.replace(/[^\d.]/g, "")
      ) || 0;
    const remainingTokens = parseInt(
      response.headers.get("x-ratelimit-remaining-tokens"),
      10
    );
    const resetTokensSec =
      parseFloat(
        response.headers.get("x-ratelimit-reset-tokens")?.replace(/[^\d.]/g, "")
      ) || 0;

    console.log("\n📊 Rate Limit Info:");
    console.log("OpenAI Request ID:", response.headers.get("x-request-id"));
    console.log("Remaining Requests:", remainingRequests);
    console.log("Requests Reset In (s):", resetRequestsSec);
    console.log("Remaining Tokens:", remainingTokens);
    console.log("Tokens Reset In (s):", resetTokensSec);

    // ===== Auto-throttle if near limit =====
    if (remainingRequests <= REQUEST_THRESHOLD) {
      console.warn(
        `⚠️ Near request limit (${remainingRequests} left). Pausing for ${resetRequestsSec} seconds...`
      );
      await new Promise((res) => setTimeout(res, resetRequestsSec * 1000));
    }

    if (remainingTokens <= TOKEN_THRESHOLD) {
      console.warn(
        `⚠️ Near token limit (${remainingTokens} left). Pausing for ${resetTokensSec} seconds...`
      );
      await new Promise((res) => setTimeout(res, resetTokensSec * 1000));
    }

    const content = completion.choices[0].message.content.trim();
    // Remove Markdown code fences if present
    const cleanContent = content
      .replace(/^```json\s*/i, "") // remove starting ```json
      .replace(/^```\s*/i, "") // remove starting ```
      .replace(/\s*```$/, "") // remove ending ```
      .trim();

    console.log(
      `\n OpenAI Response Content for Row ID ${row.id} (${row.name}):\n${content}`
    );

    try {
      const parsedData = JSON.parse(cleanContent);
      const result = {
        id: row.id,
        name: row.name,
        parsed_response: parsedData,
      };
      fs.appendFileSync(OUTPUT_FILE, JSON.stringify(result) + "\n");
      // Pre-insert preview
      console.log(`📥 About to insert into DB for ID ${row.id}:`, parsedData);

      await db.execute(
        `UPDATE inventory
         SET type=?, region=?, state=?, city=?, aging=?, appearance=?, aroma_flavor=?, acidity_sweetness=?, serving_style=?, food_pairings=?, common_names=?
         WHERE id=?`,
        [
          parsedData.type,
          parsedData.region,
          parsedData.state,
          parsedData.city,
          parsedData.aging,
          parsedData.appearance,
          parsedData.aroma_flavor,
          parsedData.acidity_sweetness,
          parsedData.serving_style,
          parsedData.food_pairings,
          parsedData.common_names,
          row.id,
        ]
      );
      console.log(`✅ Updated ID ${row.id}: ${row.name}`);
    } catch (parseErr) {
      console.error(
        `❌ JSON parse error for ID ${row.id}: ${parseErr.message}`
      );
      fs.appendFileSync(
        ERROR_FILE,
        JSON.stringify({ id: row.id, name: row.name, raw: cleanContent }) + "\n"
      );
    }
  } catch (err) {
    console.error(
      `❌ Error processing ID ${row.id} (${row.name}):`,
      err.message
    );
  }
}

const BATCH_SIZE = 500;   // how many rows per big chunk
const SUB_BATCH_SIZE = 200; // how many rows fetched/processed at once
const PARALLEL_REQUESTS = 2; // set to 2 or 3 if you want parallel processing

async function processChunk(chunkIndex) {
  console.log(`\n🚀 Starting chunk #${chunkIndex} (rows ${(chunkIndex - 1) * BATCH_SIZE + 1}–${chunkIndex * BATCH_SIZE})...`);

  let processed = 0;
  while (processed < BATCH_SIZE) {
    const offset = (chunkIndex - 1) * BATCH_SIZE + processed;
    const batch = await fetchBatch(SUB_BATCH_SIZE, offset);

    if (!batch.length) {
      console.log("✅ No more rows to process.");
      return false; // signal we're fully done
    }

    if (PARALLEL_REQUESTS > 1) {
      // Process rows in parallel (limit concurrency)
      const groups = [];
      for (let i = 0; i < batch.length; i += PARALLEL_REQUESTS) {
        const subset = batch.slice(i, i + PARALLEL_REQUESTS);
        groups.push(
          Promise.allSettled(subset.map(row => enrichRow(row)))
        );
      }
      for (const group of groups) await group;
    } else {
      // Sequential (safest)
      for (const row of batch) {
        await enrichRow(row);
      }
    }

    processed += batch.length;
    console.log(`📈 Processed ${processed} / ${BATCH_SIZE} in this chunk`);
    await new Promise(res => setTimeout(res, 100)); // pacing
  }

  console.log(`🎯 Finished chunk #${chunkIndex}`);
  return true; // signal more rows may remain
}

async function runAll(startChunk = 1) {
  console.log("🚀 Starting full enrichment job...");
  fs.writeFileSync(OUTPUT_FILE, "");
  fs.writeFileSync(ERROR_FILE, "");

  let chunkIndex = startChunk;
  while (await processChunk(chunkIndex)) {
    chunkIndex++;
  }

  console.log("🎉 All rows enriched!");
  process.exit(0);
}

runAll();

