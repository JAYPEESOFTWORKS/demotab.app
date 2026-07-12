// Run with: npx tsx src/simulation.test.ts
// Plays the bundled sample project end-to-end through several branches.
import { createProject, createSampleProject } from './model';
import { SimSnapshot, choose, startSimulation } from './simulation';

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL ${name}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

const sample = createSampleProject();

function pick(snap: SimSnapshot, labelPart: string): SimSnapshot {
  const choice = snap.choices.find((c) => c.label.toLowerCase().includes(labelPart.toLowerCase()));
  if (!choice) {
    throw new Error(
      `No choice containing "${labelPart}" among: ${snap.choices.map((c) => c.label).join(' | ')}`
    );
  }
  return choose(sample, snap, choice);
}

function next(snap: SimSnapshot): SimSnapshot {
  const first = snap.choices[0];
  if (!first) throw new Error('Expected at least one choice');
  return choose(sample, snap, first);
}

// --- Branch 1: haggle succeeds, reach the ending ---------------------------
let snap = startSimulation(sample);
check('starts without error', snap.error === null, snap.error);
check('first line is the guard greeting', snap.node?.displayName === 'Greeting', snap.node?.displayName);
check('greeting offers a continuation', snap.choices.length >= 1);

snap = next(snap); // into the hub
check('hub presents two choices', snap.choices.length === 2, snap.choices.map((c) => c.label));
check(
  'pay choice hidden (gold 8 < 10 input condition)',
  !snap.choices.some((c) => c.label.toLowerCase().includes('pay')),
  snap.choices.map((c) => c.label)
);

snap = pick(snap, 'offer 5');
check('haggle line shown', snap.node?.displayName === 'Haggle', snap.node?.displayName);
snap = next(snap);
check(
  'condition routed to accept (gold 8 >= 5)',
  snap.node?.displayName === 'Guard accepts',
  snap.node?.displayName
);
snap = next(snap);
check('emerged from dialogue to ending', snap.node?.displayName === 'Ending', snap.node?.displayName);
check('output pin deducted 5 gold', snap.vars['inventory.gold'] === 3, snap.vars['inventory.gold']);
snap = next(snap);
check('flow ends cleanly', snap.ended && snap.error === null, snap.error);

// --- Branch 2: insult loops back to the hub via jump -----------------------
let snap2 = startSimulation(sample);
snap2 = next(snap2);
snap2 = pick(snap2, 'insult');
check('insult line shown', snap2.node?.displayName === 'Insult the guard', snap2.node?.displayName);
snap2 = next(snap2);
check('guard fumes next', snap2.node?.displayName === 'Guard fumes', snap2.node?.displayName);
check('angeredGuard set by output pin', snap2.vars['story.angeredGuard'] === true);
snap2 = next(snap2);
check('jump returns to hub choices', snap2.choices.length === 2, snap2.choices.map((c) => c.label));

// After looping back we can still finish the story.
snap2 = pick(snap2, 'offer 5');
snap2 = next(snap2);
snap2 = next(snap2);
check('branch 2 also reaches ending', snap2.node?.displayName === 'Ending', snap2.node?.displayName);

// --- Play-from-node starts inside the right container -----------------------
const hub = sample.nodes.find((n) => n.displayName === 'Your move')!;
const snap3 = startSimulation(sample, hub.id);
check('play-from-hub presents choices without error', snap3.choices.length >= 1 && !snap3.ended, snap3.error);

// --- Empty project -----------------------------------------------------------
const empty = startSimulation(createProject('empty'));
check('empty project ends with a friendly message', empty.ended && !!empty.error);

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  throw new Error('simulation tests failed');
}
console.log('\nAll simulation tests passed');
