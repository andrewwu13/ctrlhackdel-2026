
import { MatchOrchestrator } from "./match-orchestrator";

export interface SessionState {
  sessionId: string;
  userAId: string;
  userBId: string;
  userAReady: boolean;
  userBReady: boolean;
  orchestrator?: MatchOrchestrator;
}

export class SessionRegistry {
  private static instance: SessionRegistry;
  private sessions: Map<string, SessionState> = new Map();

  private constructor() {}

  public static getInstance(): SessionRegistry {
    if (!SessionRegistry.instance) {
      SessionRegistry.instance = new SessionRegistry();
    }
    return SessionRegistry.instance;
  }

  public getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  public createSession(
    sessionId: string,
    userAId: string,
    userBId: string
  ): SessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const newState: SessionState = {
      sessionId,
      userAId,
      userBId,
      userAReady: false,
      // If userB is the demo agent, they are always ready
      userBReady: userBId === "demo-agent",
    };

    this.sessions.set(sessionId, newState);
    return newState;
  }

  public setAgentReady(
    sessionId: string,
    userId: string,
    isReady: boolean
  ): SessionState | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (session.userAId === userId) {
      session.userAReady = isReady;
    } else if (session.userBId === userId) {
      session.userBReady = isReady;
    }

    return session;
  }

  public setOrchestrator(
    sessionId: string,
    orchestrator: MatchOrchestrator
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.orchestrator = orchestrator;
    }
  }

  public removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.orchestrator) {
      session.orchestrator.stop();
    }
    this.sessions.delete(sessionId);
  }
}
