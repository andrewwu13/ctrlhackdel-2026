import dotenv from "dotenv";
dotenv.config();

const frontendOrigins = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const googleClientIds = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || "")
  .split(",")
  .map((clientId) => clientId.trim())
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  frontendOrigins,
  frontendUrl: frontendOrigins[0] || "http://localhost:3000",

  // MongoDB
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/ctrlhackdel",

  // Google Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  googleClientIds,
  googleClientId: googleClientIds[0] || "",

  // ElevenLabs
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",

  // Snowflake (optional)
  snowflake: {
    account: process.env.SNOWFLAKE_ACCOUNT || "",
    user: process.env.SNOWFLAKE_USER || "",
    password: process.env.SNOWFLAKE_PASSWORD || "",
    database: process.env.SNOWFLAKE_DATABASE || "",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "",
  },
} as const;
