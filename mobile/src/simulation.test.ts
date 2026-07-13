// Run with: npx tsx src/simulation.test.ts
import { createProject, createSampleProject, createTollBridgeProject } from './model';
import {
  MultiSim,
  SimSnapshot,
  advanceThread,
  choose,
  startSimulation,
  startStory,
  threadSnapshot,
  threadStatus,
} from './simulation';

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL ${name}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// ===========================================================================
// Single-thread flow (the toll bridge)
// ===========================================================================
{
  const bridge = createTollBridgeProject();

  function pick(snap: SimSnapshot, labelPart: string): SimSnapshot {
    const choice = snap.choices.find((c) => c.label.toLowerCase().includes(labelPart.toLowerCase()));
    if (!choice) throw new Error(`No choice "${labelPart}" among ${snap.choices.map((c) => c.label).join(' | ')}`);
    return choose(bridge, snap, choice);
  }
  const next = (snap: SimSnapshot) => choose(bridge, snap, snap.choices[0]!);

  let snap = startSimulation(bridge);
  check('bridge: starts without error', snap.error === null, snap.error);
  check('bridge: first line is the greeting', snap.node?.displayName === 'Greeting', snap.node?.displayName);

  snap = next(snap); // into the hub
  check('bridge: hub presents two choices', snap.choices.length === 2, snap.choices.map((c) => c.label));
  check(
    'bridge: pay choice hidden (gold 8 < 10)',
    !snap.choices.some((c) => c.label.toLowerCase().includes('pay')),
    snap.choices.map((c) => c.label)
  );

  snap = pick(snap, 'offer 5');
  snap = next(snap);
  check('bridge: condition routed to accept', snap.node?.displayName === 'Guard accepts', snap.node?.displayName);
  snap = next(snap);
  check('bridge: emerged to ending', snap.node?.displayName === 'Ending', snap.node?.displayName);
  check('bridge: output pin deducted 5 gold', snap.vars['inventory.gold'] === 3, snap.vars['inventory.gold']);
  snap = next(snap);
  check('bridge: flow ends cleanly', snap.ended && snap.error === null, snap.error);
}

// ===========================================================================
// Multi-thread story with cross-thread item gating (Signal Night sample)
// ===========================================================================
{
  const sample = createSampleProject();
  const [theo, mara, priya] = sample.threads.map((t) => t.id) as [string, string, string];

  const status = (m: MultiSim, id: string) => threadStatus(sample, m, id);
  function advance(m: MultiSim, id: string, labelPart?: string): MultiSim {
    const snap = threadSnapshot(sample, m, id)!;
    const choice = labelPart
      ? snap.choices.find((c) => c.label.toLowerCase().includes(labelPart.toLowerCase()))
      : snap.choices[0];
    if (!choice) throw new Error(`No choice "${labelPart ?? ''}" for thread ${id}: ${snap.choices.map((c) => c.label).join(' | ')}`);
    return advanceThread(sample, m, id, choice);
  }

  let m = startStory(sample);
  check('signal: three threads start', Object.keys(m.positions).length === 3);
  check('signal: Theo ready, others blocked', status(m, theo) === 'ready' && status(m, mara) === 'blocked' && status(m, priya) === 'blocked', {
    theo: status(m, theo),
    mara: status(m, mara),
    priya: status(m, priya),
  });
  check('signal: no items held at start', m.env['items.power'] === false && m.env['items.roof_key'] === false);

  m = advance(m, theo); // t1 -> t2 (no grant yet)
  check('signal: others still blocked before Theo finishes power', status(m, mara) === 'blocked' && status(m, priya) === 'blocked');

  m = advance(m, theo); // leaving t2 grants power + roof_key
  check('signal: power + roof key granted', m.env['items.power'] === true && m.env['items.roof_key'] === true);
  check('signal: Mara and Priya unblocked by Theo', status(m, mara) === 'ready' && status(m, priya) === 'ready', {
    mara: status(m, mara),
    priya: status(m, priya),
  });

  m = advance(m, theo); // t3 Continue -> Theo complete
  check('signal: Theo complete', status(m, theo) === 'complete', status(m, theo));

  // Priya can boot and calibrate, but then waits on the dish.
  m = advance(m, priya); // p1 -> p2 (requires power, held)
  m = advance(m, priya); // p2 -> p3
  check('signal: Priya blocked waiting on the dish', status(m, priya) === 'blocked', status(m, priya));
  check('signal: dish not yet aligned', m.env['items.dish_aligned'] === false);

  // Mara: reach the hub, make the WRONG choice first (force), on a fresh run.
  {
    let bad = startStory(sample);
    bad = advance(bad, theo);
    bad = advance(bad, theo); // grant power + key
    bad = advance(bad, mara); // m1 -> m2
    bad = advance(bad, mara); // m2 -> hub
    bad = advance(bad, mara, 'force'); // wrong choice: no dish_aligned
    check('signal: forcing does not grant the dish', bad.env['items.dish_aligned'] === false);
    bad = advance(bad, priya);
    bad = advance(bad, priya);
    check('signal: with wrong choice Priya stays blocked forever', threadStatus(sample, bad, priya) === 'blocked');
  }

  // Back on the main run: Mara oils the gears (right choice) -> dish aligned.
  m = advance(m, mara); // m1 -> m2
  m = advance(m, mara); // m2 -> hub
  m = advance(m, mara, 'oil');
  m = advance(m, mara); // leaving oil grants dish_aligned, emerge -> complete
  check('signal: oiling grants the dish', m.env['items.dish_aligned'] === true);
  check('signal: Mara complete', status(m, mara) === 'complete', status(m, mara));
  check('signal: Priya now unblocked', status(m, priya) === 'ready', status(m, priya));

  // Priya finishes through the media beat and narration to the ending.
  m = advance(m, priya); // p3 -> media beat
  const beat = threadSnapshot(sample, m, priya)!;
  check('signal: media beat is presented', beat.node?.kind === 'media_beat', beat.node?.kind);
  m = advance(m, priya); // media beat -> narration
  const narr = threadSnapshot(sample, m, priya)!;
  check('signal: narration beat is presented', narr.node?.kind === 'narration', narr.node?.kind);
  check('signal: narration recorded as its own transcript kind', narr.transcript.some((l) => l.kind === 'narration'));
  m = advance(m, priya); // narration -> ending
  check('signal: story finished at the ending', m.finished === true);
  check('signal: Priya reached the ending', status(m, priya) === 'complete');
}

// ===========================================================================
// Degenerate cases
// ===========================================================================
{
  const empty = startSimulation(createProject('empty'));
  check('empty project ends with a friendly message', empty.ended && !!empty.error);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  throw new Error('simulation tests failed');
}
console.log('\nAll simulation tests passed');
