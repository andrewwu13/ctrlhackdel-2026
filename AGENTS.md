
Find Love without the hassle - Skip the weird messages , stop getting ghosted,  jump right to your soulmate. Valentine's Special Hack
Agentic dating platform
Use snowflake api
Confess your feelings tab
Potentially use elevenlabs so user can talk to ai to create profile so it can actually mimic speech patterns through text



USER ONBOARDING
Interactive setup flow
Hard coded core questions (values, boundaries, lifestyle)
Free form preferences (dynamic conversation)
After, sliders/selectors to refine a user profile
Generate a user profile vector (personality/value embeddings, preference constraints, hard/soft filters)
Real-time streaming for realtime conversation
User profile vector
The user should be able to edit this a bit, add preferences, add interests, add hobbies
This should always be able to be accessed for the user

AGENT
Includes a personality system prompt
Access to user profile vector
Memory of past conversations
Voice via elevenlabs

AGENT-TO-AGENT CONVERSATION LAYER
Text-first, if we have time then voice. Also, agents should talk like they are you, not represent
Hard stop at exactly 180 seconds. State machine runs: INIT → LIVE (0–180s) → WRAP (170–180s) → SCORE
So, at 170 seconds, agents can shift towards wrapping up, and offer final signals, and summarize impressions
Agents are GOAL-CONDITIONED
Each agent has its own internal objectives and pursue these organically 
Extract 2 value signals
Extract 1 lifestyle constraint
Identify 1 shared interest
Gauge emotional tone stabilit
To avoid feeling interview-like: give them conversational constraints
Never ask 2 direct questions consecutively
Always respond emotionally before probing
Transition topics via association
Maintain reciprocity ratio (no monologues)
Continuous compatibility score (no using genai for this)
Pre conversation (30%): 
cosine similarity between user profile embeddings
Hard constraint filtering (boolean gate)
Outputs: 
preConversationScore (float)
hardConstraintPassed (bool)
Personality alignment score (20%): each agent turns into a personality vector
We can continuously update this vector and calculate the similarity while the vector evolves
Outputs:
personality_vector = [openness, conscientiousness, extraversion, agreeableness, neuroticism]
Using: 
Embedding projection against trait anchors
Keyword-based reinforcement signals
Emotional + conversational flow (25%): 
Sentiment polarity alignment
Sentiment stability over time
Response latency variance
Message length balance
Outputs: FlowScore (float)
Semantic topic alignment + overlap:
Tracking 
Topic embedding similarity growth
Shared interest emergence
Sustained topic depth 
FINAL SCORE:
Final_score =  0.30 preConversationScore +  0.25 personalityScore + 0.25 flowScore + 0.20 topicScore
Every message, update personality vector, update sentiment trend, update engagement metrics, recalculate weighted score 
We can display this on the UI (💘 Compatibility: 63% → 71% → 78%) engaging 
Update every 2-3, using exponential moving average 
smoothed_score = alpha * new_score + (1 - alpha) * prev_score
After conversation ends, calculate a final score and display overall % and a breakdown radar chart with strengths, friction zones, etc. 
COMPATABILITY ENGINE
Inputs:
Profile vector (embeddings, filters, personality vector) os users
Chat messages (content, timestamps, sender)
Per-message sentiment
Per-message topic embedding
Outputs:
compatibilityScore: number (0-100)
preConversationScore: number
inConversationScore: number
hardConstraintPassed: boolean
trendOverTime: number[] (for UI graph)
recommendMatch: boolean


ARCHITECTURE
Stack: Node.js/Express + Socket.IO (backend), Next.js 14 (frontend), MongoDB Atlas, Gemini API
Websockets via Socket.IO for streaming + LLM streaming response
STT 
TTS (eleven labs)
Once we create a user profile, the user is then taken to the dating page where agents are able to talk to each other

FRONTEND (Next.js 14 / TypeScript):
Socket.IO client (socket.io-client)
Live onboarding chat
Live agent-to-agent conversation
Key views:
  Onboarding flow          → frontend/src/app/onboarding/page.tsx
  Live agent conversation  → frontend/src/app/conversation/page.tsx
  Match summary + radar    → frontend/src/app/match-summary/page.tsx
Components:
  Chat.tsx                 — reusable message list + input
  CompatibilityMeter.tsx   — animated score gauge
  CountdownRing.tsx        — SVG 180s countdown
  RadarChart.tsx           — 4-axis score breakdown
  ProfileSliders.tsx       — Big-5 personality sliders
Hooks:
  useSocket.ts             — Socket.IO connection lifecycle
  useCompatibility.ts      — live score subscription

BACKEND (Node.js / Express / Socket.IO / TypeScript):
Match orchestrator         → backend/src/services/match-orchestrator.ts
  Initiate agent sessions
  INIT → LIVE → WRAP → SCORE state machine (180s)
  Manages two agent engines + timer
Agent engine               → backend/src/services/agent-engine.ts
  Gemini (gemini-2.0-flash) for conversation generation
  Structured system prompts with personality embedding
  Memory per session (in-memory)
  Goal-conditioned behaviour (conversational constraints baked into prompt)
Profile builder            → backend/src/services/profile-builder.ts
  Generates embeddings via Gemini text-embedding-004
  Extracts Big-5 personality traits via Gemini
  Assembles hard/soft filter constraints
Scoring engine             → backend/src/services/scoring-engine.ts
  Receives each message 
  Handles embedding similarity, sentiment analysis, trait classification, telemetry metrics, score aggregation
  EMA smoothing
Telemetry                  → backend/src/services/telemetry.ts
  Captures timestamps per message, token length, sentiment, topic embedding
REST routes:
  POST /api/onboarding/start  → backend/src/routes/onboarding.ts
  POST /api/match/start       → backend/src/routes/match.ts
  GET  /api/match/:sessionId  → backend/src/routes/match.ts
  GET  /api/health             → backend/src/routes/health.ts
Socket.IO namespaces:
  /onboarding                → backend/src/sockets/onboarding.handler.ts
  /conversation              → backend/src/sockets/conversation.handler.ts

DATA LAYER:
MongoDB Atlas (via Mongoose) → backend/src/db/mongo.ts
  Users, User profiles, Profile vectors, Conversation logs, Compatibility results
Snowflake (stub)             → backend/src/db/snowflake.ts
  Aggregated analytics, Trend dashboards

INTEGRATIONS:
ElevenLabs                   → backend/src/integrations/elevenlabs.ts
  During onboarding: User speaks -> STT to text, extract speech style markers, use to shape agent's tone
  During agent conversation: Optional TTS for demo

DEPLOYMENT:
Docker Compose               → docker-compose.yml
  backend (Node.js :4000), frontend (Next.js :3000), mongo (MongoDB 7 :27017)
  Backend Dockerfile          → backend/Dockerfile
  Frontend Dockerfile         → frontend/Dockerfile

---
IMPLEMENTATION STATUS (all files stubbed — logic TODOs marked inline):
[ ] User onboarding — core questions flow working, free-form + profile builder need Gemini wiring
[ ] Agent engine — system prompt + Gemini call stubbed, needs end-to-end testing
[ ] Match orchestrator — state machine + timer implemented, needs integration with socket handler
[ ] Scoring engine — all 4 score components + EMA implemented with stubs, needs real embeddings
[ ] Telemetry — capture service ready, needs MongoDB persistence
[ ] ElevenLabs — STT/TTS stubs created, needs API key + integration
[ ] Snowflake — connector stub created
[ ] Frontend pages — onboarding, conversation, match-summary pages scaffolded
[ ] Frontend components — Chat, CompatibilityMeter, CountdownRing, RadarChart, ProfileSliders ready
[ ] Docker — compose + Dockerfiles created
