<div align="center">

# ⚖️ Divan

**Five AI minds debate your decision in an Ace Attorney–style courtroom — and the output is a diagnosis, not a verdict.**

`5 Minds · 1 Diagnosis · Not a Verdict`

</div>

---

## What is Divan?

**Divan** (named after the *Divan-ı Hümâyun*, the imperial council of the Ottoman court) is a desktop decision-support tool. You bring a question you're stuck on. Five different large language models — each playing a distinct persona — argue it out across four phases, refereed by a neutral judge. The result isn't "do X." It's a **map of exactly where the disagreement lives**, how confident the council really is, and what you'd need to learn to make the call yourself.

Most decision tools give you *more* opinions. Divan assumes you're stuck because you already have too many. So instead of piling on, it makes the **fault line** visible — the single axis the whole decision actually turns on — and forces a clear stance with a confidence signal and a kill-condition.

> The most valuable signal is in the **spread** of the independent opening statements, not in any later "consensus." Agreement between models trained on similar data and tuned to be agreeable is cheap. Disagreement is information.

---

## The Council

Five members + one judge. The judge is a **separate instance** — it has no persona and no opinion; it only frames, finds the fault line, rules on objections, and synthesizes.

| Character | Role | Its one job | The trap it balances |
|---|---|---|---|
| **Athena** | Strategist | 2nd/3rd-order consequences — "where does this put us in 6 months?" | short-term excitement |
| **Socrates** | Skeptic | attacks the **reasoning** itself — finds the rot inside the logic (epistemic) | "sounds reasonable" |
| **Apollo** | Creative | reframes the problem — "what if we don't do it at all?" | getting stuck in one solution space |
| **Hephaestus** | Engineer | feasibility, cost, real effort, technical debt | "easy on paper" |
| **Atlas** | Realist | data, numbers, "who actually pays for this and why" (empirical) | falling in love with your own idea |
| **Themis** | Judge | frames the question, picks the fault line, rules objections, writes the verdict | — |

> **Skeptic ≠ Realist.** Socrates attacks *your reasoning* ("that assumption is baseless because…"). Atlas leans on *the outside world* ("the market says no, because the data…"). One is internal logic, the other is external evidence.

---

## How it works — 4 phases

```
Raw question
  │
  ▼
[Phase 0] FRAMING (Judge)        → turns a fuzzy question into a decidable proposition
  │
  ▼
[Phase 1] INDEPENDENT OPENINGS   → 5 models answer in PARALLEL and ISOLATION.
  │                                 They never see each other. (the core of the system)
  ▼
[Phase 2] CLASH (single axis)    → Judge picks the one fault line; members collide only there.
  │                                 Formal objections → ruled upheld / overruled.
  ▼
[Phase 3] SYNTHESIS (Judge)      → decision + confidence + weighted vote + kill-condition
                                    + a minority report that always survives.
```

**Three principles the design never breaks:**

1. **Phase 1 isolation.** Models don't see each other's answers. This keeps their errors uncorrelated and prevents fake consensus.
2. **Voting is a signal, not a decision.** The judge decides. The tally is a *weighted* signal — confidence is never computed as `support / total`.
3. **Synthesis never erases disagreement.** The minority report always survives and stays visible. The right answer is often the minority one.

The final verdict includes a **flip-condition** digest: combine what would change each member's mind, and you get a concrete list of things to go research — the system doesn't just say "do this," it says "learn these two things and your decision becomes certain."

---

## Features

- 🎭 **Ace Attorney–style courtroom** — pixel UI, character sprites, "OBJECTION! / HOLD IT!" moments, desk slams, gavel, and a verdict card.
- 🔌 **Hybrid provider layer** — each member can run on a subscription CLI (Claude Code, Codex, agy/Antigravity) **or** a direct API (Anthropic, OpenAI, Google/Gemini, DeepSeek, xAI) **or** local (Ollama). Swap backends per character without touching the pipeline.
- ⚙️ **Settings panel** — multi-provider (a different model per character) or single-provider (e.g. "everything on Gemini"), per-character model + backend selection, API-key entry, and an **active-members** toggle (you don't have to use all five).
- 🌍 **Turkish / English** — the whole UI and every AI response follow the selected language.
- 🖥️ **Desktop app** — Electron shell that boots the backend automatically.
- 📜 **Structured logging** — every phase/member step is traced so you can see exactly where a run is.

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React 18 + TypeScript + Vite + Tailwind, XState (phase flow), Framer Motion |
| Backend | FastAPI (Python), `asyncio` orchestration |
| Streaming | Server-Sent Events (SSE) |
| Providers | Adapter layer over CLIs, HTTP APIs, and local Ollama |

---

## Getting started

### Prerequisites
- **Node.js** 18+ and **Python** 3.11+
- At least one provider configured (an API key, or a logged-in CLI like `claude` / `codex` / `agy`, or a local `ollama`).

### Setup

```bash
# 1. Backend
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows  (use: source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt

# 2. Frontend
cd ../frontend
npm install

# 3. Run the desktop app (auto-starts the backend on :8000)
npm run dev
```

Open the app, hit **⚙ Settings**, choose your mode (multi/single provider), pick models/backends per character, enter any API keys, then enter a question and start the trial.

### Configuration

API keys and per-character settings are stored locally in `backend/.divan/settings.json` (git-ignored). You can also seed defaults via a `.env` file — see [`.env.example`](.env.example).

---

## Project layout

```
backend/        FastAPI app, 4-phase orchestrator, provider adapters, personas
frontend/       React + Electron UI (courtroom, dialogue, verdict, settings)
```

---

## Notes

- Sound effects and the courtroom aesthetic are inspired by the *Ace Attorney* series for personal use; replace them with royalty-free or original assets before any commercial distribution.
- Divan is a **decision-support** tool. It deliberately refuses to decide *for* you — it shows you the shape of the disagreement so you can decide better.

---

<div align="center">
<sub>Divan — because the goal isn't more opinions. It's seeing exactly where they split.</sub>
</div>
