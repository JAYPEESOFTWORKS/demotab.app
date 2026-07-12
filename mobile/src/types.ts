// Core data model. Concepts mirror a professional narrative-design tool:
// a nested flow of typed nodes, entities, locations, and namespaced
// global variables driven by a small scripting language.

export type VariableType = 'boolean' | 'integer' | 'string';
export type ScriptValue = boolean | number | string;

export interface Variable {
  id: string;
  name: string; // identifier within its set, e.g. "gold"
  type: VariableType;
  defaultValue: ScriptValue;
  description: string;
}

export interface VariableSet {
  id: string;
  name: string; // namespace, e.g. "inventory" -> scripts use "inventory.gold"
  variables: Variable[];
}

export type NodeKind =
  | 'flow_fragment' // container for arbitrary sub-flow
  | 'dialogue' // container for a conversation
  | 'dialogue_fragment' // a single line of dialogue
  | 'hub' // routing / choice point
  | 'jump' // go-to another node
  | 'condition' // branches on a script expression (true / false pins)
  | 'instruction' // executes a script, then continues
  | 'media_beat'; // placeholder for rich interactive content built later
                  // (a drone view, a mini-game, a video clip, …)

export interface FlowNode {
  id: string;
  kind: NodeKind;
  parentId: string | null; // null = top level of the flow
  displayName: string;
  // Main payload. Meaning depends on kind:
  //  dialogue_fragment -> spoken text
  //  condition        -> boolean expression
  //  instruction      -> script statements
  //  containers/hub   -> description
  text: string;
  menuText: string; // dialogue_fragment: label shown as a player choice
  stageDirections: string; // dialogue_fragment
  speakerId: string | null; // dialogue_fragment -> Entity id
  targetId: string | null; // jump -> destination node id
  color: string | null; // custom color override (else kind color)
  x: number;
  y: number;
  inputPinScript: string; // condition evaluated before entering (empty = true)
  outputPinScript: string; // instruction executed when leaving (empty = none)
  requiresItems: string[]; // Item ids that must be held before this node can be entered
  grantsItems: string[]; // Item ids the player gains when leaving this node
  isEnding: boolean; // reaching this node completes the whole story (the goal)
}

// Condition nodes have two output pins: 0 = true, 1 = false.
// Every other kind only uses pin 0.
export interface Connection {
  id: string;
  parentId: string | null; // scope: same container as its endpoints
  sourceId: string;
  sourcePin: 0 | 1;
  targetId: string;
  label: string;
}

export interface EntityProperty {
  id: string;
  key: string;
  value: string;
}

export interface Entity {
  id: string;
  name: string;
  color: string;
  description: string;
  properties: EntityProperty[];
}

export interface LocationItem {
  id: string;
  name: string;
  description: string;
}

// A collectible piece of story state. Modeled as a global flag ("obtained" /
// "not obtained") so one thread granting an item can unlock another. Items are
// exposed to scripts as `items.<key>` booleans, so conditions can also read
// them directly (e.g. `items.access_card && story.alarmOff`).
export interface Item {
  id: string;
  key: string; // identifier, referenced in scripts as items.<key>
  name: string; // display name
  description: string;
}

// A parallel storyline the player can switch between. Threads share all global
// state (variables + items), so progress in one can gate another. A project
// with no threads plays as a single linear flow.
export interface StoryThread {
  id: string;
  name: string;
  characterId: string | null; // Entity that anchors this thread (optional)
  startNodeId: string | null; // node where this thread begins
  color: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: FlowNode[];
  connections: Connection[];
  entities: Entity[];
  locations: LocationItem[];
  variableSets: VariableSet[];
  items: Item[];
  threads: StoryThread[];
}

export const PROJECT_EXPORT_FORMAT = 'storydraft.project.v1';

export interface ProjectExport {
  format: typeof PROJECT_EXPORT_FORMAT;
  exportedAt: number;
  project: Project;
}
