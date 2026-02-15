import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import { connectMongo } from "./db/mongo";

// Routes
import healthRouter from "./routes/health";
import onboardingRouter from "./routes/onboarding";
import converseRouter from "./routes/converse";
import matchRouter from "./routes/match";
import profileRouter from "./routes/profile";
import ttsRouter from "./routes/tts";
import authRouter from "./routes/auth";

// Socket handlers
import { registerOnboardingHandlers } from "./sockets/onboarding.handler";
import { registerConversationHandlers } from "./sockets/conversation.handler";

// ── Express App ────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────────

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.frontendOrigins,
    methods: ["GET", "POST"],
  },
});

// ── Middleware ──────────────────────────────────────────────────────

app.use(cors({ origin: config.frontendOrigins }));
app.use(express.json());

// ── REST Routes ────────────────────────────────────────────────────

app.use("/api/health", healthRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/onboarding", converseRouter);
app.use("/api/match", matchRouter);
app.use("/api/profile", profileRouter);
app.use("/api/tts", ttsRouter);
app.use("/api/auth", authRouter);

// ── Socket.IO Namespaces ───────────────────────────────────────────

const onboardingNamespace = io.of("/onboarding");
const conversationNamespace = io.of("/conversation");

registerOnboardingHandlers(onboardingNamespace);
registerConversationHandlers(conversationNamespace);

// ── Start Server ───────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectMongo();

    httpServer.listen(config.port, () => {
      console.log(`\n🚀 Server running on http://localhost:${config.port}`);
      console.log(`   REST API:    http://localhost:${config.port}/api/health`);
      console.log(`   Socket.IO:   ws://localhost:${config.port}`);
      console.log(`   Namespaces:  /onboarding, /conversation\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();

export { app, io };
