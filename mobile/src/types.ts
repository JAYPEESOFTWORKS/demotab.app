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
  | 'instruction'; // executes a script, then continues

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
}

export const PROJECT_EXPORT_FORMAT = 'storydraft.project.v1';

export interface ProjectExport {
  format: typeof PROJECT_EXPORT_FORMAT;
  exportedAt: number;
  project: Project;
}
