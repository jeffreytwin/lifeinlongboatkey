# Longboat Key Map — Claude Code Handoff Package

Everything you need to take the prototype from chat into a real, buildable project.

## What's in this folder

| File | What it is | Where it goes |
|---|---|---|
| `CLAUDE.md` | Project brief — architecture, data model, filter design, open decisions | **Project root.** Claude Code reads this automatically every session. |
| `communities.json` | 108 enriched community records (derived from your Wix CSV) | `data/` folder in the project, or wherever Parrish keeps its data |
| `longboat-key-map-mockup.html` | Working HTML prototype | Keep in project as design reference. Not part of the production build. |
| `KICKOFF_PROMPT.md` | The first message to paste into Claude Code | Use once. Don't commit. |

## Step-by-step workflow

### 1. Set up the project folder (5 min)

```bash
# If forking Parrish:
git clone https://github.com/jeffreytwin/[YOUR_PARRISH_REPO].git life-in-longboat-key-map
cd life-in-longboat-key-map

# Update remote to point to a new repo you create on GitHub
git remote set-url origin https://github.com/jeffreytwin/life-in-longboat-key-map.git
git push -u origin main

# Drop the handoff files into the project
```

Copy these three files into the repo root:
- `CLAUDE.md`
- `communities.json`
- `longboat-key-map-mockup.html`

Commit them so Claude Code has them available from the start:
```bash
git add CLAUDE.md communities.json longboat-key-map-mockup.html
git commit -m "Add handoff brief, data, and prototype"
```

### 2. Install Claude Code (if you don't have it)

If you haven't installed Claude Code on this machine yet, the fastest path is the VS Code extension — given your comfort level, I'd recommend it over the terminal version.

- **Claude Code for VS Code** — install from the VS Code marketplace, sign in, it opens a chat panel inside your editor where you can see file changes happen in real time. Best fit for you.
- **Claude Code terminal** — if you want to run it from the command line, install via `npm install -g @anthropic-ai/claude-code`, then run `claude` in the project directory. Identical capability, just a different interface.

If you're unsure, use the VS Code extension. You can see exactly what Claude Code is doing and approve changes before they're applied.

### 3. Start a Claude Code session

Open VS Code (or a terminal) in the project root. Launch Claude Code. Then:

1. Open `KICKOFF_PROMPT.md` and copy the "Paste this" block.
2. Paste it as your first message in Claude Code.
3. Wait for Claude Code to read the context and respond.
4. Answer its clarifying questions.
5. Only then give the green light to start coding.

### 4. First milestone — scaffold

Before anything fancy, get the boring plumbing working:
- Forked Parrish repo builds and runs locally (`npm run dev` or equivalent)
- `communities.json` is loaded into the app state
- Filter panel renders against the LBK data (counts update correctly per filter)
- No map yet — just prove the data flows

This should be a single Claude Code session, maybe two.

### 5. Second milestone — map

- Leaflet shell with OSM tiles
- Pins for all 108 communities (using estimated coords for now)
- Marker clustering
- Pin ↔ card sync (hover card highlights pin, click pin opens popup)

### 6. Third milestone — polish

- Mobile drawer
- Community photos on cards
- Real geocoding pass
- Firebase deploy pipeline
- Wix embed

## Working rhythm with Claude Code

A few things that helped on your Parrish / Lakewood Auto-Blogger projects that apply here too:

- **Commit often.** Before any big Claude Code change, commit what's working. Makes it trivial to roll back if a suggestion breaks something.
- **One scope per session.** Don't mix "build the filters" and "fix the deploy pipeline" in the same conversation. Claude Code stays sharper with one focused goal.
- **Screenshot feedback works.** Same as our earlier sessions — if something looks off, screenshot it and drop it into Claude Code. Faster than describing visual issues in words.
- **Update `CLAUDE.md` as decisions get locked in.** It's not a static doc. As you answer open questions, move them from "Open Decisions" to "Architecture Decisions" in the file.

## If you get stuck

The `CLAUDE.md` file is designed to be re-read at any point. If a session drifts, just tell Claude Code: "Re-read CLAUDE.md and tell me where we are against the plan." That resets it.
