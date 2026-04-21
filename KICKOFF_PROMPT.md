# First message to paste into Claude Code

Copy the text below into your first Claude Code session. It gives Claude Code the right starting constraints so it doesn't run off and start coding before it understands the project.

---

## Paste this:

I'm building a production interactive neighborhoods/condos map for lifeinlongboatkey.com. This project picks up from a working HTML prototype I built in a previous Claude session.

**Before you write any code, please:**

1. Read `CLAUDE.md` in this directory — it contains the full project brief, architecture decisions, data model, filter design, and open decisions.
2. Open `longboat-key-map-mockup.html` and study the prototype. This IS the design spec — the filter set, map behavior, and information hierarchy are all intentional. Pay attention to what's included AND what's deliberately omitted (e.g., no Garage filter, no linear price slider).
3. Inspect `communities.json` to understand the enriched data shape.

**Then, before coding:**

1. Summarize back to me in 5–7 bullets what you've understood from `CLAUDE.md`, so I know we're aligned before we start building.
2. Tell me the top 3 open decisions in `CLAUDE.md` that you think block progress most, and ask me for those.
3. My sibling Parrish project lives at https://github.com/jeffreytwin/[REPO_NAME — I'll give you the exact URL]. The architectural plan is to fork it. Ask me for the repo URL and read access setup.

**Don't:**
- Start coding before I've answered the open decisions
- Invent data fields or filter behaviors that aren't in the prototype
- Deviate from the Parrish repo's conventions without flagging it first

Once we've aligned, our first coding milestone is a project scaffold (forked Parrish repo, LBK data wired in, filters rendering against `communities.json`) — no map yet, just the filter panel proving the data flows.

---

## After you paste that, expect Claude Code to:

- Read the three reference files
- Give you a structured summary
- Ask ~3–5 specific questions (tile provider, geocoding approach, Parrish repo access, mobile scope, etc.)
- Wait for your answers before proceeding

**Do not skip this alignment step.** Claude Code is fast and capable, but that means it can also build the wrong thing quickly if you don't front-load context.
