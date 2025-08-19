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

async function fetchBatch(limit = 50) {
  const [rows] = await db.execute(
    `SELECT id, name FROM inventory 
     WHERE type IS NULL OR type = '' 
     LIMIT ${limit}`
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
  try {
    const { data: completion, response } = await openai.chat.completions
      .create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a beverage and liquor expert specializing in U.S. drinks. 

Always return a JSON object matching the provided schema.  

Special rules:
- "aging" should describe barrel type, duration, or be null if unknown.
- "region" must be a broad U.S. area (Midwest, Southwest, Pacific Northwest etc).
- "state" must be a U.S. state if identifiable.
- "city" must be a U.S. city if identifiable.
- Use short, clear text (≤ 15 words).
- Use null when information is not available.`,
          },
          {
            role: "user",
            content: `The drink name is: "${row.name}"`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "DrinkEnrichment",
            schema: {
              type: "object",
              properties: {
                type: {
                  type: ["string", "null"],
                  description: "Type of beverage (e.g., Wine, Bourbon, Beer)",
                },
                region: {
                  type: ["string", "null"],
                  description:
                    "Broad U.S. area (Midwest, Southwest, Pacific Northwest, etc.)",
                },
                state: {
                  type: ["string", "null"],
                  description: "U.S. state if identifiable",
                },
                city: {
                  type: ["string", "null"],
                  description: "U.S. city if identifiable",
                },
                aging: {
                  type: ["string", "null"],
                  description:
                    "Aging details, e.g., '8 years or Aged in French oak barrels for 10 months'",
                },
                appearance: { type: ["string", "null"] },
                aroma_flavor: { type: ["string", "null"] },
                acidity_sweetness: { type: ["string", "null"] },
                serving_style: { type: ["string", "null"] },
                food_pairings: {
                  type: ["string", "null"],
                  description: "Comma-separated food pairings",
                },
                common_names: {
                  type: ["string", "null"],
                  description: "Comma-separated common names",
                },
              },
              required: [
                "type",
                "region",
                "state",
                "city",
                "aging",
                "appearance",
                "aroma_flavor",
                "acidity_sweetness",
                "serving_style",
                "food_pairings",
                "common_names",
              ],
            },
          },
        },
      })
      .withResponse();

    // ===== Rate limit logs (keep same) =====
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

    // ===== Parsed response is always JSON now =====
    const parsedData = JSON.parse(completion.choices[0].message.content);

    const result = {
      id: row.id,
      name: row.name,
      parsed_response: parsedData,
    };
    fs.appendFileSync(OUTPUT_FILE, JSON.stringify(result) + "\n");

    // Pre-insert preview
    console.log(`📥 About to insert into DB for ID ${row.id}:`, parsedData);

    // await db.execute(
    //   `UPDATE inventory
    //    SET type=?, region=?, state=?, city=?, aging=?, appearance=?, aroma_flavor=?, acidity_sweetness=?, serving_style=?, food_pairings=?, common_names=?
    //    WHERE id=?`,
    //   [
    //     parsedData.type,
    //     parsedData.region,
    //     parsedData.state,
    //     parsedData.city,
    //     parsedData.aging,
    //     parsedData.appearance,
    //     parsedData.aroma_flavor,
    //     parsedData.acidity_sweetness,
    //     parsedData.serving_style,
    //     parsedData.food_pairings,
    //     parsedData.common_names,
    //     row.id,
    //   ]
    // );

    console.log(`✅ Updated ID ${row.id}: ${row.name}`);
  } catch (err) {
    console.error(
      `❌ Error processing ID ${row.id} (${row.name}):`,
      err.message
    );
    fs.appendFileSync(
      ERROR_FILE,
      JSON.stringify({ id: row.id, name: row.name, error: err.message }) + "\n"
    );
  }
}

async function run() {
  console.log("🚀 Starting inventory enrichment...");
  fs.writeFileSync(OUTPUT_FILE, ""); // clear file at start
  fs.writeFileSync(ERROR_FILE, ""); // clear file at start

  const totalPending = await getTotalPendingRows();
  console.log(`📊 Total rows pending enrichment: ${totalPending}`);

  let batch;
  const batchSize = 20;
  let processed = 0;

  batch = await fetchBatch(batchSize);

  console.log(`Batch of ${batchSize} records fetched from db`);
  console.log(batch);

  if (!batch.length) {
    console.log("No rows found to process.");
    process.exit(0);
  }

  // while (batch.length > 0) {
  for (const row of batch) {
    await enrichRow(row);
    processed++;
    const percent = ((processed / totalPending) * 100).toFixed(2);
    console.log(`📈 Progress: ${processed} / ${totalPending} (${percent}%)`);
    await new Promise((res) => setTimeout(res, 100)); // small delay to avoid hitting rate limits
  }
  // console.log("Processing new batch")
  // Fetch the next batch after processing the current one
  //   batch = await fetchBatch(batchSize);
  // }

  console.log("🎯 Enrichment complete!");
  process.exit(0);
}

run();
