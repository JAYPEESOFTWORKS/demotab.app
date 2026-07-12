import type {
  Connection,
  Entity,
  FlowNode,
  Item,
  LocationItem,
  NodeKind,
  Project,
  ProjectExport,
  ScriptValue,
  StoryThread,
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
  media_beat: 'Media Beat',
};

export const NODE_KIND_COLOR: Record<NodeKind, string> = {
  flow_fragment: '#7a5cd6',
  dialogue: '#2f9e69',
  dialogue_fragment: '#3f8cff',
  hub: '#d6a03c',
  jump: '#8a8f98',
  condition: '#c25b5b',
  instruction: '#3aa7a3',
  media_beat: '#e07b39',
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
    requiresItems: [],
    grantsItems: [],
    isEnding: false,
  };
}

export function createEntity(name: string): Entity {
  return { id: makeId(), name, color: '#3f8cff', description: '', properties: [] };
}

export function createLocation(name: string): LocationItem {
  return { id: makeId(), name, description: '' };
}

const THREAD_COLORS = ['#4f8cff', '#e07b39', '#2f9e69', '#c95fa4', '#d6a03c', '#7a5cd6'];

export function createItem(name: string, key: string): Item {
  return { id: makeId(), name, key, description: '' };
}

export function createStoryThread(name: string, index = 0): StoryThread {
  return {
    id: makeId(),
    name,
    characterId: null,
    startNodeId: null,
    color: THREAD_COLORS[index % THREAD_COLORS.length]!,
  };
}

/** Turns a free-text item name into a safe `items.<key>` identifier. */
export function slugifyKey(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1');
  return base || 'item';
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
    items: [],
    threads: [],
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

export function itemById(project: Project, id: string | null): Item | undefined {
  if (!id) return undefined;
  return project.items.find((i) => i.id === id);
}

export function threadById(project: Project, id: string | null): StoryThread | undefined {
  if (!id) return undefined;
  return project.threads.find((t) => t.id === id);
}

/** Env key a script uses to read an item's obtained-state: `items.<key>`. */
export function itemEnvKey(item: Item): string {
  return `items.${item.key}`;
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
  // Items begin un-obtained and live in the same env under `items.<key>`.
  for (const item of project.items) {
    env[itemEnvKey(item)] = false;
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
  const base = createProject(candidate.name);
  const merged = {
    ...base,
    ...candidate,
    id: makeId(), // never collide with an existing project
    updatedAt: Date.now(),
  };
  // Backfill fields added after older exports were written, and normalize nodes.
  merged.items = Array.isArray(candidate.items) ? candidate.items : [];
  merged.threads = Array.isArray(candidate.threads) ? candidate.threads : [];
  merged.locations = Array.isArray(candidate.locations) ? candidate.locations : [];
  merged.variableSets = Array.isArray(candidate.variableSets) ? candidate.variableSets : [];
  merged.entities = Array.isArray(candidate.entities) ? candidate.entities : [];
  merged.nodes = merged.nodes.map((n) => ({
    ...n,
    requiresItems: Array.isArray(n.requiresItems) ? n.requiresItems : [],
    grantsItems: Array.isArray(n.grantsItems) ? n.grantsItems : [],
    isEnding: typeof n.isEnding === 'boolean' ? n.isEnding : false,
  }));
  return merged;
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
// Sample project seeded on first launch. It teaches the signature pattern:
// several parallel threads that share an inventory, where progress in one
// thread unlocks another, and a single ending that only opens once the
// required pieces have been gathered across all of them.
// ---------------------------------------------------------------------------

export function createSampleProject(): Project {
  const project = createProject('Signal Night (tutorial)');

  const theo = createEntity('Theo');
  theo.color = '#4f8cff';
  theo.description = 'In the basement, wrestling the building’s ancient wiring.';
  const mara = createEntity('Mara');
  mara.color = '#e07b39';
  mara.description = 'On the roof with the radio dish, waiting on a way in.';
  const priya = createEntity('Priya');
  priya.color = '#2f9e69';
  priya.description = 'At the control console, ready to catch the signal.';
  project.entities = [theo, mara, priya];

  // Items are the pieces that pass between threads.
  const power = createItem('Main power', 'power');
  power.description = 'Theo brings the mains up; Priya’s console needs it.';
  const roofKey = createItem('Roof hatch key', 'roof_key');
  roofKey.description = 'Theo finds it; Mara needs it to reach the dish gears.';
  const dishAligned = createItem('Dish aligned', 'dish_aligned');
  dishAligned.description = 'Mara locks the dish on target; the finale needs it.';
  project.items = [power, roofKey, dishAligned];

  const grants = (n: FlowNode, ...ids: string[]) => (n.grantsItems = ids);
  const requires = (n: FlowNode, ...ids: string[]) => (n.requiresItems = ids);

  // --- Thread containers (top level) --------------------------------------
  const basement = createNode('flow_fragment', null, 60, 60);
  basement.displayName = 'Basement — Theo';
  const roof = createNode('flow_fragment', null, 60, 260);
  roof.displayName = 'Rooftop — Mara';
  const control = createNode('flow_fragment', null, 60, 460);
  control.displayName = 'Control Room — Priya';

  // --- Theo (basement): grants power + roof key, then done ----------------
  const t1 = createNode('dialogue_fragment', basement.id, 40, 60);
  t1.displayName = 'Fuse box';
  t1.speakerId = theo.id;
  t1.text = 'The fuse box is a rat’s nest, but I can bring the mains up. Give me a second.';
  const t2 = createNode('dialogue_fragment', basement.id, 320, 60);
  t2.displayName = 'Power up';
  t2.speakerId = theo.id;
  t2.text = 'Power’s back. And a brass key was hanging by the panel — must be the roof hatch. Sending it up.';
  grants(t2, power.id, roofKey.id);
  const t3 = createNode('dialogue_fragment', basement.id, 600, 60);
  t3.displayName = 'Holding down here';
  t3.speakerId = theo.id;
  t3.text = 'I’ll keep the mains steady. Over to you two.';

  // --- Mara (roof): blocked until the key exists, then a real choice ------
  const m1 = createNode('dialogue_fragment', roof.id, 40, 60);
  m1.displayName = 'Locked out';
  m1.speakerId = mara.id;
  m1.text = 'The dish is frozen and the gearbox hatch is locked. I can’t do a thing up here yet.';
  const m2 = createNode('dialogue_fragment', roof.id, 320, 60);
  m2.displayName = 'Hatch open';
  m2.speakerId = mara.id;
  m2.text = 'Got Theo’s key — hatch is open. The gears are stiff with old grease.';
  requires(m2, roofKey.id);
  const mHub = createNode('hub', roof.id, 600, 60);
  mHub.displayName = 'Free the dish';
  const mForce = createNode('dialogue_fragment', roof.id, 880, -40);
  mForce.displayName = 'Force it';
  mForce.menuText = 'Force the gears by hand';
  mForce.speakerId = mara.id;
  mForce.text = 'I’ll muscle it… no — something cracked. The bearing’s shot. It won’t align now.';
  const mOil = createNode('dialogue_fragment', roof.id, 880, 160);
  mOil.displayName = 'Oil first';
  mOil.menuText = 'Oil the gears, then turn';
  mOil.speakerId = mara.id;
  mOil.text = 'Oil first, then a slow turn — there. The dish swings free and locks on target.';
  grants(mOil, dishAligned.id);

  // --- Priya (control): needs power, then waits on the dish, then ending --
  const p1 = createNode('dialogue_fragment', control.id, 40, 60);
  p1.displayName = 'Dead console';
  p1.speakerId = priya.id;
  p1.text = 'Console’s dark. Nothing happens here until the mains come up.';
  const p2 = createNode('dialogue_fragment', control.id, 320, 60);
  p2.displayName = 'Booting';
  p2.speakerId = priya.id;
  p2.text = 'Power’s on — console’s alive. Receivers calibrated. Now I just need the dish pointed.';
  requires(p2, power.id);
  const p3 = createNode('dialogue_fragment', control.id, 600, 60);
  p3.displayName = 'Standing by';
  p3.speakerId = priya.id;
  p3.text = 'Locked and ready on my end. Waiting on the dish…';
  const pBeat = createNode('media_beat', control.id, 880, 60);
  pBeat.displayName = 'Receiver waterfall';
  pBeat.text =
    'INTERACTIVE MOMENT: the player watches the live receiver waterfall as the dish settles, and taps the faint trace when it appears.';
  requires(pBeat, dishAligned.id);
  const pEnd = createNode('dialogue_fragment', control.id, 1160, 60);
  pEnd.displayName = 'We caught it';
  pEnd.speakerId = priya.id;
  pEnd.text = 'There it is. Faint, but unmistakable. Everyone — we caught the signal.';
  pEnd.isEnding = true;

  project.nodes = [
    basement,
    roof,
    control,
    t1,
    t2,
    t3,
    m1,
    m2,
    mHub,
    mForce,
    mOil,
    p1,
    p2,
    p3,
    pBeat,
    pEnd,
  ];

  const link = (
    parentId: string | null,
    sourceId: string,
    targetId: string,
    sourcePin: 0 | 1 = 0,
    label = ''
  ): Connection => ({ id: makeId(), parentId, sourceId, sourcePin, targetId, label });

  project.connections = [
    // Theo
    link(basement.id, t1.id, t2.id),
    link(basement.id, t2.id, t3.id),
    // Mara
    link(roof.id, m1.id, m2.id),
    link(roof.id, m2.id, mHub.id),
    link(roof.id, mHub.id, mForce.id),
    link(roof.id, mHub.id, mOil.id),
    // Priya
    link(control.id, p1.id, p2.id),
    link(control.id, p2.id, p3.id),
    link(control.id, p3.id, pBeat.id),
    link(control.id, pBeat.id, pEnd.id),
  ];

  project.threads = [
    { ...createStoryThread('Theo — Basement', 0), characterId: theo.id, startNodeId: basement.id },
    { ...createStoryThread('Mara — Rooftop', 1), characterId: mara.id, startNodeId: roof.id },
    { ...createStoryThread('Priya — Control', 2), characterId: priya.id, startNodeId: control.id },
  ];

  return project;
}

/** The original single-thread example, kept as an alternate sample. */
export function createTollBridgeProject(): Project {
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
