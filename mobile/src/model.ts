import type {
  Connection,
  Entity,
  FlowNode,
  LocationItem,
  NodeKind,
  Project,
  ProjectExport,
  ScriptValue,
  Variable,
  VariableSet,
  VariableType,
} from './types';
import { PROJECT_EXPORT_FORMAT } from './types';
import type { VarEnv } from './script/engine';

export function makeId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 6)
  );
}

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  flow_fragment: 'Flow Fragment',
  dialogue: 'Dialogue',
  dialogue_fragment: 'Dialogue Fragment',
  hub: 'Hub',
  jump: 'Jump',
  condition: 'Condition',
  instruction: 'Instruction',
};

export const NODE_KIND_COLOR: Record<NodeKind, string> = {
  flow_fragment: '#7a5cd6',
  dialogue: '#2f9e69',
  dialogue_fragment: '#3f8cff',
  hub: '#d6a03c',
  jump: '#8a8f98',
  condition: '#c25b5b',
  instruction: '#3aa7a3',
};

export function isContainer(kind: NodeKind): boolean {
  return kind === 'flow_fragment' || kind === 'dialogue';
}

export function createNode(kind: NodeKind, parentId: string | null, x: number, y: number): FlowNode {
  return {
    id: makeId(),
    kind,
    parentId,
    displayName: NODE_KIND_LABEL[kind],
    text: '',
    menuText: '',
    stageDirections: '',
    speakerId: null,
    targetId: null,
    color: null,
    x,
    y,
    inputPinScript: '',
    outputPinScript: '',
  };
}

export function createEntity(name: string): Entity {
  return { id: makeId(), name, color: '#3f8cff', description: '', properties: [] };
}

export function createLocation(name: string): LocationItem {
  return { id: makeId(), name, description: '' };
}

export function createVariableSet(name: string): VariableSet {
  return { id: makeId(), name, variables: [] };
}

export function defaultValueFor(type: VariableType): ScriptValue {
  if (type === 'boolean') return false;
  if (type === 'integer') return 0;
  return '';
}

export function createVariable(name: string, type: VariableType): Variable {
  return { id: makeId(), name, type, defaultValue: defaultValueFor(type), description: '' };
}

export function createProject(name: string): Project {
  const now = Date.now();
  return {
    id: makeId(),
    name,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    connections: [],
    entities: [],
    locations: [],
    variableSets: [],
  };
}

export function nodeById(project: Project, id: string | null): FlowNode | undefined {
  if (!id) return undefined;
  return project.nodes.find((n) => n.id === id);
}

export function entityById(project: Project, id: string | null): Entity | undefined {
  if (!id) return undefined;
  return project.entities.find((e) => e.id === id);
}

export function childrenOf(project: Project, parentId: string | null): FlowNode[] {
  return project.nodes.filter((n) => n.parentId === parentId);
}

export function connectionsIn(project: Project, parentId: string | null): Connection[] {
  return project.connections.filter((c) => c.parentId === parentId);
}

export function outgoing(project: Project, nodeId: string, pin?: 0 | 1): Connection[] {
  return project.connections.filter(
    (c) => c.sourceId === nodeId && (pin === undefined || c.sourcePin === pin)
  );
}

export function incoming(project: Project, nodeId: string): Connection[] {
  return project.connections.filter((c) => c.targetId === nodeId);
}

/** Entry nodes of a container scope: nodes with no incoming connection. */
export function startNodes(project: Project, parentId: string | null): FlowNode[] {
  const scoped = childrenOf(project, parentId);
  const withoutIncoming = scoped.filter((n) => incoming(project, n.id).length === 0);
  const pool = withoutIncoming.length > 0 ? withoutIncoming : scoped;
  return [...pool].sort((a, b) => a.x - b.x || a.y - b.y);
}

/** All descendant node ids of a container, including the node itself. */
export function subtreeIds(project: Project, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of project.nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Removes a node, its descendants, and every connection touching them. */
export function deleteNodeDeep(project: Project, nodeId: string): Project {
  const doomed = subtreeIds(project, nodeId);
  return {
    ...project,
    nodes: project.nodes.filter((n) => !doomed.has(n.id)),
    connections: project.connections.filter((c) => !doomed.has(c.sourceId) && !doomed.has(c.targetId)),
  };
}

export function initialVarEnv(project: Project): VarEnv {
  const env: VarEnv = {};
  for (const set of project.variableSets) {
    for (const v of set.variables) {
      env[`${set.name}.${v.name}`] = v.defaultValue;
    }
  }
  return env;
}

export function projectToExport(project: Project): ProjectExport {
  return { format: PROJECT_EXPORT_FORMAT, exportedAt: Date.now(), project };
}

export function parseProjectImport(raw: string): Project {
  const data = JSON.parse(raw) as unknown;
  const candidate =
    data && typeof data === 'object' && 'project' in data
      ? (data as ProjectExport).project
      : (data as Project);
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.nodes) ||
    !Array.isArray(candidate.connections)
  ) {
    throw new Error('Not a valid StoryDraft project export');
  }
  return {
    ...createProject(candidate.name),
    ...candidate,
    id: makeId(), // never collide with an existing project
    updatedAt: Date.now(),
  };
}

/** Deep copy with a fresh project id. */
export function duplicateProject(project: Project, name: string): Project {
  const copy = JSON.parse(JSON.stringify(project)) as Project;
  copy.id = makeId();
  copy.name = name;
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  return copy;
}

// ---------------------------------------------------------------------------
// Sample project seeded on first launch so the app demonstrates itself.
// ---------------------------------------------------------------------------

export function createSampleProject(): Project {
  const project = createProject('The Toll Bridge (sample)');

  const guard = createEntity('Bridge Guard');
  guard.color = '#c25b5b';
  guard.description = 'A weary soldier collecting tolls on the old stone bridge.';
  guard.properties = [
    { id: makeId(), key: 'Role', value: 'Antagonist' },
    { id: makeId(), key: 'Mood', value: 'Irritable' },
  ];
  const traveler = createEntity('Traveler');
  traveler.color = '#3f8cff';
  traveler.description = 'The player character, low on coin and patience.';
  project.entities = [guard, traveler];

  project.locations = [
    { id: makeId(), name: 'Stone Bridge', description: 'The only crossing over the river for miles.' },
    { id: makeId(), name: 'Riverbank', description: 'Muddy, cold, and rumored to hide a ford.' },
  ];

  const inv = createVariableSet('inventory');
  const gold = createVariable('gold', 'integer');
  gold.defaultValue = 8;
  gold.description = 'Coins in the traveler’s pouch.';
  inv.variables = [gold];

  const story = createVariableSet('story');
  const angered = createVariable('angeredGuard', 'boolean');
  angered.description = 'Set when the traveler insults the guard.';
  const crossed = createVariable('crossed', 'boolean');
  crossed.description = 'True once the traveler reaches the far side.';
  story.variables = [angered, crossed];
  project.variableSets = [inv, story];

  // Top level: an instruction, then a Dialogue container, then an ending.
  const setup = createNode('instruction', null, 60, 200);
  setup.displayName = 'Setup';
  setup.text = 'story.angeredGuard = false; story.crossed = false';

  const talk = createNode('dialogue', null, 320, 200);
  talk.displayName = 'At the Bridge';
  talk.text = 'The toll negotiation.';

  const ending = createNode('dialogue_fragment', null, 620, 200);
  ending.displayName = 'Ending';
  ending.speakerId = traveler.id;
  ending.text = 'The far bank at last. Whatever it cost, the road goes on.';
  ending.outputPinScript = 'story.crossed = true';

  // Inside the dialogue container:
  const d = talk.id;
  const greet = createNode('dialogue_fragment', d, 40, 220);
  greet.displayName = 'Greeting';
  greet.speakerId = guard.id;
  greet.text = 'Ten gold to cross. No coin, no crossing.';
  greet.stageDirections = 'The guard bars the way with a rusted halberd.';

  const choiceHub = createNode('hub', d, 300, 220);
  choiceHub.displayName = 'Your move';

  const pay = createNode('dialogue_fragment', d, 560, 60);
  pay.displayName = 'Pay the toll';
  pay.menuText = 'Pay the toll (10 gold)';
  pay.speakerId = traveler.id;
  pay.text = 'Fine. Here — ten gold. It’s all I have.';
  pay.inputPinScript = 'inventory.gold >= 10';
  pay.outputPinScript = 'inventory.gold -= 10';

  const haggle = createNode('dialogue_fragment', d, 560, 220);
  haggle.displayName = 'Haggle';
  haggle.menuText = 'Offer 5 gold';
  haggle.speakerId = traveler.id;
  haggle.text = 'Five gold, and I forget to mention the hole in your boot.';

  const insult = createNode('dialogue_fragment', d, 560, 380);
  insult.displayName = 'Insult the guard';
  insult.menuText = 'Insult him';
  insult.speakerId = traveler.id;
  insult.text = 'I’ve seen scarecrows with more authority.';
  insult.outputPinScript = 'story.angeredGuard = true';

  const haggleCheck = createNode('condition', d, 820, 220);
  haggleCheck.displayName = 'Enough gold?';
  haggleCheck.text = 'inventory.gold >= 5';

  const accept = createNode('dialogue_fragment', d, 1080, 140);
  accept.displayName = 'Guard accepts';
  accept.speakerId = guard.id;
  accept.text = 'Five, then. And the boot stays between us.';
  accept.outputPinScript = 'inventory.gold -= 5';

  const broke = createNode('dialogue_fragment', d, 1080, 320);
  broke.displayName = 'Too poor';
  broke.speakerId = guard.id;
  broke.text = 'You haven’t even got five! Off with you.';

  const angry = createNode('dialogue_fragment', d, 820, 420);
  angry.displayName = 'Guard fumes';
  angry.speakerId = guard.id;
  angry.text = 'Right. For that, the toll is doubled — and swim if you don’t like it.';

  const backToHub = createNode('jump', d, 1080, 460);
  backToHub.displayName = 'Try again';
  backToHub.targetId = choiceHub.id;

  project.nodes = [
    setup,
    talk,
    ending,
    greet,
    choiceHub,
    pay,
    haggle,
    insult,
    haggleCheck,
    accept,
    broke,
    angry,
    backToHub,
  ];

  const link = (
    parentId: string | null,
    sourceId: string,
    targetId: string,
    sourcePin: 0 | 1 = 0,
    label = ''
  ): Connection => ({ id: makeId(), parentId, sourceId, sourcePin, targetId, label });

  project.connections = [
    link(null, setup.id, talk.id),
    link(null, talk.id, ending.id),
    link(d, greet.id, choiceHub.id),
    link(d, choiceHub.id, pay.id),
    link(d, choiceHub.id, haggle.id),
    link(d, choiceHub.id, insult.id),
    link(d, haggle.id, haggleCheck.id),
    link(d, haggleCheck.id, accept.id, 0, 'true'),
    link(d, haggleCheck.id, broke.id, 1, 'false'),
    link(d, insult.id, angry.id),
    link(d, angry.id, backToHub.id),
    link(d, broke.id, backToHub.id),
  ];

  return project;
}
