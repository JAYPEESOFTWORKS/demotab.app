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
| **Flow editor** | Touch canvas with pan, pinch-zoom, drag-to-move nodes. Tap to select, double-tap containers to open them (breadcrumb navigation back up). |
| **Node types** | Flow Fragment & Dialogue (nested containers), Dialogue Fragment (spoken line with speaker, menu text, stage directions), Hub (choice point), Jump (go to any node), Condition (true/false pins), Instruction (runs a script). |
| **Connections** | Select a node → Link → tap the target. Conditions link separately from their ✓ and ✗ pins. Labels and removal in the node editor. |
| **Pins** | Every node has an input-pin condition (blocks entry when false — hides choices) and an output-pin script (runs when leaving the node). |
| **Entities** | Characters/things with color, description, and custom key-value properties. Dialogue fragments pick one as speaker. |
| **Locations** | Simple named places with descriptions. |
| **Variables** | Namespaced sets (`inventory`, `story`, …) of boolean / integer / string variables with defaults and descriptions. |
| **Scripting** | Expression language for conditions and instructions: `inventory.gold >= 10`, `inventory.gold -= 10; story.paid = true`, `&& || ! == != < <= > >= + - * / %`, string and boolean literals, `//` comments. Live syntax validation in the editor. |
| **Presentation mode** | Play the story from the start or from any selected node. Evaluates conditions, executes instructions, filters choices by input-pin conditions, submerges into containers and emerges at their ends, follows jumps. Includes a transcript, choice buttons, a live variable inspector, and restart. |

A sample project, **The Toll Bridge**, is seeded on first launch. It
demonstrates nested dialogue, hubs, hidden choices (pay requires 10 gold but
you start with 8), a condition branch, output-pin scripts, and a jump loop.

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
    ├── types.ts                 # project / node / connection / variable model
    ├── model.ts                 # factories, graph helpers, sample project
    ├── script/engine.ts         # tokenizer, parser, evaluator for the script language
    ├── simulation.ts            # interactive playback of a flow
    ├── storage.ts               # AsyncStorage persistence
    ├── store.tsx                # React context: project list + updates + autosave
    ├── theme.ts
    ├── components/
    │   ├── ui.tsx               # buttons, fields, sheets, chips
    │   ├── FlowCanvas.tsx       # pan/zoom canvas, node views, SVG connections
    │   └── NodeEditorSheet.tsx  # per-kind node property editor
    └── screens/
        ├── ProjectListScreen.tsx
        ├── ProjectScreen.tsx    # tab shell: Flow / Entities / Variables / Locations
        ├── FlowScreen.tsx       # breadcrumbs, toolbar, linking, add/delete nodes
        ├── EntitiesScreen.tsx
        ├── VariablesScreen.tsx
        ├── LocationsScreen.tsx
        └── SimulationModal.tsx  # presentation mode player
```

## Design notes

- **No navigation or gesture libraries.** Navigation is plain React state;
  canvas gestures are implemented with core `PanResponder` (one-finger pan,
  two-finger pinch anchored at the midpoint, per-node drag with tap/double-tap
  detection). Fewer native dependencies = runs in Expo Go out of the box.
- **The simulation mirrors the editor semantics exactly** and is pure
  TypeScript with no React Native imports, so it is unit-tested in Node
  (`src/simulation.test.ts` plays the sample story through multiple branches).
- **Containers submerge/emerge**: entering a Dialogue/Flow Fragment starts at
  its entry node (no incoming connections); when a branch inside dead-ends,
  playback emerges and continues from the container's own outgoing
  connections.

## Not (yet) implemented

Compared to a desktop narrative suite: multi-user collaboration/version
control, engine exports (Unity/Unreal), localization tables, template/schema
customization, and a global search. The JSON export is a stable, versioned
format (`storydraft.project.v1`) that downstream tooling could consume.
