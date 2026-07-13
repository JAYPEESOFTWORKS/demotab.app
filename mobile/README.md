# StoryDraft (mobile)

A mobile narrative-design tool for iOS and Android, inspired by the core
workflow of desktop tools like articy:draft: design branching, interactive
stories as a visual node flow, drive them with global variables and a small
scripting language, and play them back interactively — all on a phone or
tablet.

Built with Expo / React Native + TypeScript. Everything is stored locally on
the device; projects can be exported and imported as JSON.

> This is an independent, clean-room implementation of the *concepts* of
> narrative-design software. It contains no code, assets, or branding from
> articy:draft, and is not affiliated with or endorsed by Articy Software.

## Features

| Area | What you get |
|---|---|
| **Projects** | Create, rename, duplicate, delete. JSON export via the share sheet, import by pasting JSON. Auto-saved locally (AsyncStorage). |
| **Flow editor** | Touch canvas with pan, pinch-zoom, drag-to-move nodes. Tap to select, double-tap containers to open them (breadcrumb navigation back up). Nodes badge their item/ending metadata (🔒 requires, 🎁 grants, ★ ending). |
| **Node types** | Flow Fragment & Dialogue (nested containers), Dialogue Fragment (spoken line with speaker, menu text, stage directions), **Narration** (narrator / cutscene prose with no character, for tying threads together between beats), Hub (choice point), Jump (go to any node), Condition (true/false pins), Instruction (runs a script), **Media Beat** (placeholder for rich interactive content built later — a drone view, a video clip, a mini-game). |
| **Threads** | Parallel storylines the player switches between, sharing all global state. Progress in one thread can unblock another. A project with no threads plays as a single linear flow. |
| **Items (inventory)** | Global collectible pieces. A node can *grant* an item and another node — even in a different thread — can *require* it, so one character's progress unlocks another's. Exposed to scripts as `items.<key>`. |
| **Endings** | Mark any node as the story ending. Combine with "requires items" so the goal only opens once every piece has been collected across all threads. |
| **Connections** | Select a node → Link → tap the target. Conditions link separately from their ✓ and ✗ pins. Labels and removal in the node editor. |
| **Pins** | Every node has an input-pin condition (blocks entry when false — hides choices) and an output-pin script (runs when leaving the node). |
| **Entities** | Characters/things with color, description, and custom key-value properties. Dialogue fragments pick one as speaker; threads pick one as their lead. |
| **Locations** | Simple named places with descriptions. |
| **Variables** | Namespaced sets (`inventory`, `story`, …) of boolean / integer / string variables with defaults and descriptions. |
| **Scripting** | Expression language for conditions and instructions: `inventory.gold >= 10`, `inventory.gold -= 10; story.paid = true`, `&& || ! == != < <= > >= + - * / %`, string and boolean literals, `//` comments. Live syntax validation in the editor. |
| **Play / presentation mode** | For a single flow: play from the start or any selected node, with transcript, choices, a live state inspector, and restart. For a multi-thread story: a **switchboard** showing every thread's status (Ready / Waiting / Done), where blocked threads visibly wait on state from the others, plus a shared-state inspector and a "story complete" state when the ending is reached. |

A sample project, **Signal Night**, is seeded on first launch. Three
volunteers — Theo, Mara, and Priya — must ready an old radio observatory
before dawn. It demonstrates the signature pattern: Theo's thread grants the
power and the roof key that unblock the other two; Mara must make the *right*
choice (oil the gears, don't force them) to align the dish; and Priya's ending
only opens once the dish is aligned. It also includes a media beat (watching
the signal come in) as a placeholder for a richer interactive moment.

> **Designing a story, not shipping a game.** StoryDraft is a general-purpose
> authoring tool: you work out the whole branching structure here, export it as
> JSON, and build the actual game (with the real interactive media beats)
> wherever you like. The versioned export format (`storydraft.project.v1`) is
> the hand-off.

## Running it

```bash
cd mobile
npm install
npm start          # Expo dev server; scan the QR code with Expo Go
npm run android    # or launch directly on a connected device/emulator
npm run ios
```

Checks:

```bash
npm run typecheck  # strict TypeScript
npm test           # script-engine + simulation tests (run in Node via tsx)
```

To produce store-ready binaries use [EAS Build](https://docs.expo.dev/build/introduction/):
`npx eas build --platform all`.

## Code map

```
mobile/
├── App.tsx                      # root: store provider + 2-screen navigation
└── src/
    ├── types.ts                 # project / node / connection / variable / item / thread model
    ├── model.ts                 # factories, graph helpers, sample project
    ├── script/engine.ts         # tokenizer, parser, evaluator for the script language
    ├── simulation.ts            # single-thread walker + multi-thread driver
    ├── storage.ts               # AsyncStorage persistence
    ├── store.tsx                # React context: project list + updates + autosave
    ├── theme.ts
    ├── components/
    │   ├── ui.tsx               # buttons, fields, sheets, chips, segmented control
    │   ├── FlowCanvas.tsx       # pan/zoom canvas, node views + badges, SVG connections
    │   └── NodeEditorSheet.tsx  # per-kind node property editor (incl. items / ending)
    └── screens/
        ├── ProjectListScreen.tsx
        ├── ProjectScreen.tsx    # tab shell: Flow / Threads / Cast / State / Places
        ├── FlowScreen.tsx       # breadcrumbs, toolbar, linking, add/delete nodes
        ├── ThreadsScreen.tsx    # manage parallel storylines
        ├── EntitiesScreen.tsx   # the cast
        ├── StateScreen.tsx      # variables + items (segmented)
        ├── VariablesScreen.tsx
        ├── ItemsScreen.tsx
        ├── LocationsScreen.tsx
        └── SimulationModal.tsx  # single-flow player + multi-thread switchboard
```

## Design notes

- **No navigation or gesture libraries.** Navigation is plain React state;
  canvas gestures are implemented with core `PanResponder` (one-finger pan,
  two-finger pinch anchored at the midpoint, per-node drag with tap/double-tap
  detection). Fewer native dependencies = runs in Expo Go out of the box.
- **The simulation mirrors the editor semantics exactly** and is pure
  TypeScript with no React Native imports, so it is unit-tested in Node
  (`src/simulation.test.ts` plays the sample story through multiple branches
  and asserts the cross-thread item gating, including that a wrong choice
  soft-locks the finale).
- **Containers submerge/emerge**: entering a Dialogue/Flow Fragment starts at
  its entry node (no incoming connections); when a branch inside dead-ends,
  playback emerges and continues from the container's own outgoing
  connections.
- **Threads share one env**: the multi-thread driver runs each thread through
  the same single-thread walker over a single shared variable/item
  environment, so a thread is *blocked* (rather than finished) when its only
  continuations are gated by state another thread hasn't produced yet.

## Roadmap

The next pass focuses on comfort for long, solo, phone-based authoring:
undo/redo, project-wide search, faster node quick-add, and a zoomed-out map of
the whole story. Further out, and closer to a desktop narrative suite:
multi-user collaboration/version control, engine exports (Unity/Unreal),
localization, and custom templates/schemas. The JSON export is a stable,
versioned format (`storydraft.project.v1`) that downstream tooling — including
whatever engine you build the finished game in — can consume today.
