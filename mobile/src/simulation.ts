// Interactive playback of a flow. Two layers:
//
//  * A single-thread walker (startSimulation / choose) that steps through one
//    flow: evaluating conditions, running instructions and pin scripts,
//    submerging into containers and emerging when a branch ends, following
//    jumps, gating entry on item possession, and stopping at the story ending.
//
//  * A multi-thread driver (startStory / advanceThread) that runs several
//    threads in parallel over a single shared variable/item environment, so
//    progress in one thread can unblock another. Each thread reuses the
//    single-thread walker; they simply share the env.

import type { Connection, FlowNode, Project } from './types';
import {
  childrenOf,
  entityById,
  initialVarEnv,
  isContainer,
  itemEnvKey,
  nodeById,
  outgoing,
  startNodes,
} from './model';
import { evaluateCondition, executeInstruction, type VarEnv } from './script/engine';

export interface SimChoice {
  connectionId: string | null;
  targetId: string;
  label: string;
}

export interface TranscriptLine {
  id: string;
  speaker: string | null;
  text: string;
  kind: 'line' | 'media' | 'narration';
}

export interface SimSnapshot {
  vars: VarEnv;
  stack: string[]; // container ids we are currently inside
  node: FlowNode | null; // the node being presented (fragment, media beat, or hub)
  choices: SimChoice[];
  transcript: TranscriptLine[];
  ended: boolean;
  reachedEnding: boolean; // ended by reaching a node flagged as the story ending
  error: string | null;
}

const STEP_LIMIT = 1000;

const PRESENTABLE = new Set<FlowNode['kind']>(['dialogue_fragment', 'media_beat', 'narration']);

function choiceLabel(project: Project, node: FlowNode): string {
  if (node.menuText.trim()) return node.menuText;
  if (PRESENTABLE.has(node.kind) && node.text.trim()) {
    const t = node.text.trim();
    return t.length > 60 ? `${t.slice(0, 57)}…` : t;
  }
  return node.displayName || 'Continue';
}

function toChoice(project: Project, c: Connection): SimChoice {
  return {
    connectionId: c.id,
    targetId: c.targetId,
    label: c.label.trim() || choiceLabel(project, nodeById(project, c.targetId)!),
  };
}

/** Whether the player may enter `node`: item requirements + input condition. */
function canEnter(project: Project, env: VarEnv, node: FlowNode): boolean {
  for (const id of node.requiresItems) {
    const item = project.items.find((i) => i.id === id);
    if (item && env[itemEnvKey(item)] !== true) return false;
  }
  try {
    return evaluateCondition(node.inputPinScript, env);
  } catch {
    return false;
  }
}

/** Connections from `node` on `pin` whose target may currently be entered. */
function validOutgoing(project: Project, env: VarEnv, node: FlowNode, pin: 0 | 1): Connection[] {
  return outgoing(project, node.id, pin).filter((c) => {
    const target = nodeById(project, c.targetId);
    return target ? canEnter(project, env, target) : false;
  });
}

/**
 * Choices to present while parked at a fragment / media beat / hub, computed
 * against the current env:
 *   - some enterable connections -> those choices
 *   - no connections at all       -> a synthetic "Continue" (true dead-end)
 *   - connections, but all gated  -> [] (thread is blocked, waiting on state)
 */
function presentedChoices(project: Project, env: VarEnv, node: FlowNode): SimChoice[] {
  const valid = validOutgoing(project, env, node, 0);
  if (valid.length > 0) return valid.map((c) => toChoice(project, c));
  if (outgoing(project, node.id, 0).length === 0) {
    return [{ connectionId: null, targetId: '', label: 'Continue' }];
  }
  return [];
}

function grantItems(project: Project, env: VarEnv, ids: string[]): VarEnv {
  if (ids.length === 0) return env;
  const next = { ...env };
  for (const id of ids) {
    const item = project.items.find((i) => i.id === id);
    if (item) next[itemEnvKey(item)] = true;
  }
  return next;
}

/** Effects of leaving a node: its output-pin script, then its item grants. */
function leaveNode(project: Project, env: VarEnv, node: FlowNode): VarEnv {
  return grantItems(project, executeInstruction(node.outputPinScript, env), node.grantsItems);
}

interface WalkState {
  vars: VarEnv;
  stack: string[];
  transcript: TranscriptLine[];
}

let transcriptCounter = 0;

function pushTranscript(state: WalkState, project: Project, node: FlowNode) {
  const speaker = entityById(project, node.speakerId);
  state.transcript = [
    ...state.transcript,
    {
      id: `t${++transcriptCounter}`,
      speaker: speaker ? speaker.name : null,
      text: node.text,
      kind: node.kind === 'media_beat' ? 'media' : node.kind === 'narration' ? 'narration' : 'line',
    },
  ];
}

function snapshotOf(state: WalkState): SimSnapshot {
  return {
    vars: state.vars,
    stack: state.stack,
    node: null,
    choices: [],
    transcript: state.transcript,
    ended: false,
    reachedEnding: false,
    error: null,
  };
}

function fail(snapshot: SimSnapshot, message: string): SimSnapshot {
  return { ...snapshot, ended: true, error: message, choices: [] };
}

function errMsg(e: unknown, node: FlowNode): string {
  const base = e instanceof Error ? e.message : String(e);
  return `${base} (in "${node.displayName}")`;
}

function ancestryOf(project: Project, node: FlowNode): string[] {
  const chain: string[] = [];
  let parentId = node.parentId;
  while (parentId) {
    chain.unshift(parentId);
    parentId = nodeById(project, parentId)?.parentId ?? null;
  }
  return chain;
}

/**
 * Advances from `entry` through auto-executing nodes until a presentable node
 * (fragment, media beat, or multi-way / blocked hub) is reached, the story
 * ending is hit, or the flow runs out.
 */
function walk(project: Project, state: WalkState, entry: FlowNode | null): SimSnapshot {
  let node: FlowNode | null = entry;
  for (let steps = 0; steps < STEP_LIMIT; steps++) {
    if (node && node.isEnding) {
      if (PRESENTABLE.has(node.kind)) {
        pushTranscript(state, project, node);
      }
      try {
        state.vars = leaveNode(project, state.vars, node);
      } catch (e) {
        return fail(snapshotOf(state), errMsg(e, node));
      }
      return { ...snapshotOf(state), node, choices: [], ended: true, reachedEnding: true, error: null };
    }

    if (!node) {
      // Branch exhausted: emerge from containers until one has somewhere to go.
      while (state.stack.length > 0) {
        const containerId = state.stack[state.stack.length - 1]!;
        state.stack = state.stack.slice(0, -1);
        const container = nodeById(project, containerId);
        if (!container) continue;
        try {
          state.vars = leaveNode(project, state.vars, container);
        } catch (e) {
          return fail(snapshotOf(state), errMsg(e, container));
        }
        const first = validOutgoing(project, state.vars, container, 0)[0];
        if (first) {
          node = nodeById(project, first.targetId) ?? null;
          break;
        }
      }
      if (!node) {
        return { ...snapshotOf(state), node: null, choices: [], ended: true, error: null };
      }
      continue;
    }

    if (isContainer(node.kind)) {
      if (childrenOf(project, node.id).length > 0) {
        state.stack = [...state.stack, node.id];
        node = startNodes(project, node.id)[0] ?? null;
        continue;
      }
      node = firstTarget(project, state, node);
      continue;
    }

    switch (node.kind) {
      case 'dialogue_fragment':
      case 'media_beat':
      case 'narration': {
        pushTranscript(state, project, node);
        return { ...snapshotOf(state), node, choices: presentedChoices(project, state.vars, node), error: null };
      }
      case 'hub': {
        const valid = validOutgoing(project, state.vars, node, 0);
        if (valid.length === 1) {
          node = follow(project, state, node, valid[0]!);
          continue;
        }
        if (valid.length === 0 && outgoing(project, node.id, 0).length === 0) {
          node = leaveAndEmerge(project, state, node);
          continue;
        }
        // 0 valid but gated connections exist -> parked & blocked;
        // 2+ valid -> present the choices.
        return { ...snapshotOf(state), node, choices: presentedChoices(project, state.vars, node), error: null };
      }
      case 'instruction': {
        try {
          state.vars = executeInstruction(node.text, state.vars);
        } catch (e) {
          return fail(snapshotOf(state), errMsg(e, node));
        }
        node = firstTarget(project, state, node);
        continue;
      }
      case 'condition': {
        let pin: 0 | 1;
        try {
          pin = evaluateCondition(node.text, state.vars) ? 0 : 1;
        } catch (e) {
          return fail(snapshotOf(state), errMsg(e, node));
        }
        const first = validOutgoing(project, state.vars, node, pin)[0];
        node = first ? follow(project, state, node, first) : leaveAndEmerge(project, state, node);
        continue;
      }
      case 'jump': {
        try {
          state.vars = leaveNode(project, state.vars, node);
        } catch (e) {
          return fail(snapshotOf(state), errMsg(e, node));
        }
        const target = nodeById(project, node.targetId);
        if (!target) return fail(snapshotOf(state), `Jump "${node.displayName}" has no target`);
        state.stack = ancestryOf(project, target);
        node = target;
        continue;
      }
      default:
        node = firstTarget(project, state, node);
        continue;
    }
  }
  return fail(snapshotOf(state), 'Flow did not settle after 1000 steps (possible instruction loop)');
}

/** Executes the node's exit effects, then follows its first valid connection. */
function firstTarget(project: Project, state: WalkState, node: FlowNode): FlowNode | null {
  const first = validOutgoing(project, state.vars, node, 0)[0];
  if (!first) return leaveAndEmerge(project, state, node);
  return follow(project, state, node, first);
}

function follow(project: Project, state: WalkState, source: FlowNode, conn: Connection): FlowNode | null {
  state.vars = leaveNode(project, state.vars, source);
  return nodeById(project, conn.targetId) ?? null;
}

/** Branch ends at `node`: run its exit effects, then signal emersion. */
function leaveAndEmerge(project: Project, state: WalkState, node: FlowNode): null {
  state.vars = leaveNode(project, state.vars, node);
  return null;
}

// --- Single-thread API -----------------------------------------------------

/** Starts a walk from `startNodeId` (or the flow's entry) over `env`. */
export function startAt(project: Project, env: VarEnv, startNodeId?: string): SimSnapshot {
  const start = startNodeId ? nodeById(project, startNodeId) : startNodes(project, null)[0];
  if (!start) {
    return {
      vars: env,
      stack: [],
      node: null,
      choices: [],
      transcript: [],
      ended: true,
      reachedEnding: false,
      error: 'This flow has no nodes yet. Add a node to play.',
    };
  }
  const state: WalkState = {
    vars: env,
    stack: startNodeId ? ancestryOf(project, start) : [],
    transcript: [],
  };
  try {
    return walk(project, state, start);
  } catch (e) {
    return fail(snapshotOf(state), e instanceof Error ? e.message : String(e));
  }
}

export function startSimulation(project: Project, startNodeId?: string): SimSnapshot {
  return startAt(project, initialVarEnv(project), startNodeId);
}

export function choose(project: Project, snapshot: SimSnapshot, choice: SimChoice): SimSnapshot {
  if (snapshot.ended || !snapshot.node) return snapshot;
  const state: WalkState = {
    vars: snapshot.vars,
    stack: snapshot.stack,
    transcript: snapshot.transcript,
  };
  const current = snapshot.node;
  try {
    state.vars = leaveNode(project, state.vars, current);
    if (!choice.targetId) return walk(project, state, null); // synthetic Continue
    const target = nodeById(project, choice.targetId);
    if (!target) return fail({ ...snapshot }, 'The chosen branch no longer exists');
    return walk(project, state, target);
  } catch (e) {
    return fail({ ...snapshot }, errMsg(e, current));
  }
}

// --- Multi-thread API ------------------------------------------------------

export type ThreadStatus = 'ready' | 'blocked' | 'complete' | 'error';

interface ThreadPos {
  nodeId: string | null;
  stack: string[];
  transcript: TranscriptLine[];
  ended: boolean;
  reachedEnding: boolean;
  error: string | null;
}

export interface MultiSim {
  env: VarEnv;
  positions: Record<string, ThreadPos>;
  finished: boolean; // some thread reached the story ending
}

function posFromSnap(snap: SimSnapshot): ThreadPos {
  return {
    nodeId: snap.node?.id ?? null,
    stack: snap.stack,
    transcript: snap.transcript,
    ended: snap.ended,
    reachedEnding: snap.reachedEnding,
    error: snap.error,
  };
}

export function startStory(project: Project): MultiSim {
  let env = initialVarEnv(project);
  const positions: Record<string, ThreadPos> = {};
  for (const thread of project.threads) {
    const snap = startAt(project, env, thread.startNodeId ?? undefined);
    env = snap.vars; // opening effects persist into shared state
    positions[thread.id] = posFromSnap(snap);
  }
  return {
    env,
    positions,
    finished: project.threads.some((t) => positions[t.id]?.reachedEnding ?? false),
  };
}

/** Live view of one thread, with choices recomputed against current state. */
export function threadSnapshot(project: Project, multi: MultiSim, threadId: string): SimSnapshot | null {
  const pos = multi.positions[threadId];
  if (!pos) return null;
  const node = pos.nodeId ? (nodeById(project, pos.nodeId) ?? null) : null;
  const base: SimSnapshot = {
    vars: multi.env,
    stack: pos.stack,
    node,
    choices: [],
    transcript: pos.transcript,
    ended: pos.ended,
    reachedEnding: pos.reachedEnding,
    error: pos.error,
  };
  if (pos.error) return { ...base, ended: true };
  if (pos.ended || !node) return { ...base, ended: true };
  return { ...base, choices: presentedChoices(project, multi.env, node) };
}

export function threadStatus(project: Project, multi: MultiSim, threadId: string): ThreadStatus {
  const pos = multi.positions[threadId];
  if (!pos) return 'complete';
  if (pos.error) return 'error';
  if (pos.reachedEnding || pos.ended || !pos.nodeId) return 'complete';
  const node = nodeById(project, pos.nodeId);
  if (!node) return 'complete';
  return presentedChoices(project, multi.env, node).length > 0 ? 'ready' : 'blocked';
}

export function advanceThread(
  project: Project,
  multi: MultiSim,
  threadId: string,
  choice: SimChoice
): MultiSim {
  const snap = threadSnapshot(project, multi, threadId);
  if (!snap || !snap.node) return multi;
  const next = choose(project, snap, choice);
  return {
    env: next.vars,
    positions: { ...multi.positions, [threadId]: posFromSnap(next) },
    finished: multi.finished || next.reachedEnding,
  };
}
