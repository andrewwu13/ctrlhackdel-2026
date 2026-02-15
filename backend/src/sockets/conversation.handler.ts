
import { Namespace, Socket } from "socket.io";
import { MatchOrchestrator } from "../services/match-orchestrator";
import { ProfileBuilder } from "../services/profile-builder";
import type { MatchCallbacks } from "../services/match-orchestrator";
import { SessionRegistry } from "../services/session-registry";

/**
 * Socket.IO handler for the /conversation namespace.
 * Streams the real-time agent-to-agent conversation to the client.
 */
export function registerConversationHandlers(namespace: Namespace): void {
  const registry = SessionRegistry.getInstance();

  namespace.on("connection", (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId as string;
    const userAId = socket.handshake.query.userAId as string;
    const userBId = socket.handshake.query.userBId as string;

    console.log(
      `[Conversation] Client connected for session: ${sessionId}, users: ${userAId}, ${userBId}`
    );

    // Join a room for this session
    socket.join(sessionId);

    // Initialize or get session state
    let session = registry.getSession(sessionId);
    if (!session) {
      session = registry.createSession(sessionId, userAId, userBId);
      console.log(`[Conversation] Initialized session registry for ${sessionId}`);
    }

    // Send initial status to the connecting client
    socket.emit("agent_status_update", {
      userAId: session.userAId,
      userAReady: session.userAReady,
      userBId: session.userBId,
      userBReady: session.userBReady,
    });

    // ── Client sets active status ───────────────────────────────
    socket.on("set_agent_active", async (data: { active: boolean }) => {
      console.log(
        `[Conversation] User ${userAId} set active: ${data.active} for session ${sessionId}`
      );

      const updatedSession = registry.setAgentReady(
        sessionId,
        userAId, // The user connected on this socket is userA (usually)
        data.active
      );

      if (!updatedSession) return;

      // Broadcast new status to everyone in the room
      namespace.to(sessionId).emit("agent_status_update", {
        userAId: updatedSession.userAId,
        userAReady: updatedSession.userAReady,
        userBId: updatedSession.userBId,
        userBReady: updatedSession.userBReady,
      });

      // Check if both are ready and we haven't started yet
      if (
        updatedSession.userAReady &&
        updatedSession.userBReady &&
        !updatedSession.orchestrator
      ) {
        await startConversation(sessionId, updatedSession.userAId, updatedSession.userBId);
      }
    });

    // ── Helper to start conversation ────────────────────────────
    const startConversation = async (
      sId: string,
      uAId: string,
      uBId: string
    ) => {
      try {
        console.log(`[Conversation] Both agents ready. Starting orchestrator for ${sId}`);

        // Fetch profiles
        const profileA = await ProfileBuilder.getProfileVector(uAId);
        let profileB = await ProfileBuilder.getProfileVector(uBId);

        if (!profileA) {
          namespace.to(sId).emit("error", {
            message: `Missing profile for ${uAId}. Complete onboarding first.`,
          });
          return;
        }

        if (!profileB) {
          console.log(
            `[Conversation] No ProfileVector for ${uBId}, generating demo agent`
          );
          const now = new Date();
          profileB = {
            userId: uBId,
            embedding: new Array(768).fill(0).map(() => Math.random() * 2 - 1),
            personality: {
              openness: 0.7,
              conscientiousness: 0.6,
              extraversion: 0.65,
              agreeableness: 0.75,
              neuroticism: 0.3,
            },
            hardFilters: {},
            softFilters: {},
            createdAt: now,
            updatedAt: now,
          };
        }

        // Build summaries
        const summaryA = `User ${uAId} - Openness: ${profileA.personality.openness}, Extraversion: ${profileA.personality.extraversion}`;
        const summaryB = `User ${uBId} - Openness: ${profileB.personality.openness}, Extraversion: ${profileB.personality.extraversion}`;

        // Create callbacks
        const callbacks: MatchCallbacks = {
          onStateChange: (state) => {
            namespace.to(sId).emit("state_change", { state });
          },
          onAgentMessage: (message) => {
            namespace.to(sId).emit("agent_message", {
              id: message.id,
              sender: message.sender,
              content: message.content,
              timestamp: message.timestamp,
            });
          },
          onCompatibilityUpdate: (score, breakdown) => {
            namespace.to(sId).emit("compatibility_update", {
              score,
              breakdown,
            });
          },
          onTimerTick: (elapsedSeconds) => {
            namespace.to(sId).emit("timer_tick", { elapsedSeconds });
          },
          onConversationEnd: (result) => {
            namespace.to(sId).emit("conversation_end", {
              compatibilityScore: result.compatibilityScore,
              breakdown: result.breakdown,
              recommendMatch: result.recommendMatch,
              trendOverTime: result.trendOverTime,
            });
            // Cleanup orchestrator ref when done?
            // registry.setOrchestrator(sId, undefined); // Optional: keep it to prevent restart
          },
        };

        const orchestrator = new MatchOrchestrator(
          profileA,
          summaryA,
          profileB,
          summaryB,
          callbacks
        );

        registry.setOrchestrator(sId, orchestrator);
        await orchestrator.start();
      } catch (error) {
        console.error("[Conversation] Start error:", error);
        namespace.to(sId).emit("error", { message: "Failed to start conversation" });
      }
    };

    socket.on("disconnect", () => {
      console.log(`[Conversation] Client disconnected from session: ${sessionId}`);
      // Note: We do NOT stop the orchestrator just because one client left,
      // as the other might still be watching.
      // Orchestraor cleanup happens in registry.removeSession() if needed,
      // or via timeouts.
    });
  });
}

