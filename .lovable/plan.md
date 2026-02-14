

# SoulBound 3.0 — Hackathon Demo Build Plan

## Overview
An agentic matchmaking platform with a cinematic, LEGO-Rose aesthetic. The focus is on delivering a visually stunning, demo-ready experience that showcases the concept of AI agents negotiating compatibility on behalf of users.

> **Tech note:** Built with React + Vite + Tailwind (Lovable's stack). We'll use Framer Motion for animations, ElevenLabs for voice synthesis, and Lovable AI for the agent simulation logic (proxying to your Snowflake data via edge functions).

---

## 1. Digital Conservatory — Landing Page
The grand entrance. A dark, luxurious landing page with:
- **Animated gradient background** simulating the "Liquid Silk" effect using CSS animations and subtle mouse-tracking parallax
- **LEGO-Rose hero element** — a stylized SVG/CSS rose built from geometric brick-like shapes that assembles on page load with staggered Framer Motion animations
- **"Begin Soul-Sync" CTA** with frosted glass styling and a soft glow hover effect
- Cinematic typography with fade-in reveals

## 2. Soul-Sync Onboarding
An interactive personality capture flow (not a boring form):
- **Personality Brick Selector** — Users tap/click translucent LEGO-style tiles representing values (Innovation, Adventure, Empathy, Creativity, etc.). Each selection triggers a satisfying snap animation and prismatic glow burst
- **Voice Imprint step** — Microphone capture UI with a visual waveform. Audio is sent to ElevenLabs via edge function for voice cloning using Voice ID `zA6D7RyKdc2EClouEMkP`
- **Progress shown as a LEGO tower building** — each completed step adds a brick
- Data is stored and used to seed the agent's personality profile

## 3. Agent Lounge — The Simulation Dashboard
The technical heart, designed as "Laboratory-Chic":
- **Frosted glass cards** showing "Active Missions" — simulated real-time agent negotiation feeds
- **Scrolling "Thought Chain" terminal** — typewriter-style text showing agent reasoning (e.g., "Checking career alignment... 82% match")
- **Central Lego Rose visualization** — petals animate open/closed based on current match success rate
- **"Ghost View" hover effect** — hovering cards reveals translucent "code-like" reasoning beneath
- Agent conversations powered by Lovable AI edge function, displaying streaming results
- **Debug Mode toggle** (for the demo) — force-triggers a 90%+ match to guarantee the Golden Match reveal fires during the 3-minute pitch

## 4. Golden Match Reveal
The showstopper full-screen animation:
- Background gradient dramatically shifts from deep plum to vibrant rose-red
- **LEGO Rose descends** from the top with a physics-style bounce animation (Framer Motion spring)
- **Match profile "melts" into view** — a blurred/encrypted profile image transitions from 100px blur to crystal clear
- **ElevenLabs voice announcement** — The user's cloned agent voice streams: "I found a match. You both prioritize innovation..." via TTS edge function
- **Invitation card** slides up with match summary and Accept/Decline buttons
- Celebratory particle effects

## 5. Sincerity Engine — "Confess Your Feelings" Tab
The Valentine's Hack secret weapon:
- Dark-mode "Digital Sanctuary" UI shift
- Text input where typing triggers **real-time sentiment analysis** (via Lovable AI edge function analyzing emotional intensity)
- As sincerity score rises, the background gains a golden luminescent glow effect
- Visual feedback: a heart-rate-like pulse indicator showing emotional depth

## 6. Connection Vault (Post-Match)
Brief but polished post-match experience:
- Dashboard cards animate into LEGO studs that zip to center (Framer Motion exit animation)
- **Prismatic Message Tiles** chat interface — frosted glass message bricks with a subtle glow when the other person is "typing"
- Date Scheduler suggestion card based on shared interests

## 7. Backend / Edge Functions
- **ElevenLabs TTS** edge function for voice announcements and agent narration
- **Lovable AI** edge function for agent negotiation simulation (generating realistic multi-turn compatibility dialogues)
- **Sentiment analysis** edge function for the Sincerity Engine
- **Debug/demo mode** endpoint to trigger pre-scripted match sequences

## Design Language
- **Colors:** Deep plum (#2D1B4E), Rose-red (#E8364F), Gold (#FFD700), Frosted white (rgba overlays)
- **Glass morphism** on all cards and panels
- **LEGO-brick geometry** — rounded rectangles with subtle "stud" details
- **Typography:** Clean, modern sans-serif with cinematic fade-in reveals
- **Micro-interactions:** 0.2s hover delays, spring physics on reveals, prismatic light bursts on selections

