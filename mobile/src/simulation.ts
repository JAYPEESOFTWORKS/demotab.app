// Interactive playback of a flow: walks the node graph, evaluates condition
// nodes and input-pin conditions, executes instruction nodes and output-pin
// scripts, submerges into containers and emerges when a branch ends.

import type { Connection, FlowNode, Project } from './types';
import {
  childrenOf,
  entityById,
  initialVarEnv,
  isContainer,
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
}

export interface SimSnapshot {
  vars: VarEnv;
  stack: string[]; // container ids we are currently inside
  node: FlowNode | null; // the node being presented (dialogue fragment or hub)
  choices: SimChoice[];
  transcript: TranscriptLine[];
  ended: boolean;
  error: string | null;
}

const STEP_LIMIT = 1000;

function choiceLabel(project: Project, node: FlowNode): string {
  if (node.menuText.trim()) return node.menuText;
  if (node.kind === 'dialogue_fragment' && node.text.trim()) {
    const t = node.text.trim();
    return t.length > 60 ? `${t.slice(0, 57)}…` : t;
  }
  return node.displayName || 'Continue';
}

/** Connections from `node` on `pin` whose target input condition passes. */
function validOutgoing(project: Project, vars: VarEnv, node: FlowNode, pin: 0 | 1): Connection[] {
  return outgoing(project, node.id, pin).filter((c) => {
    const target = nodeById(project, c.targetId);
    if (!target) return false;
    try {
      return evaluateCondition(target.inputPinScript, vars);
    } catch {
      return false;
    }
  });
}

function fail(snapshot: SimSnapshot, message: string): SimSnapshot {
  return { ...snapshot, ended: true, error: message, choices: [] };
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
    },
  ];
}

/**
 * Advances from `entry` through auto-executing nodes until a presentable
 * node (dialogue fragment or multi-way hub) is reached or the flow ends.
 */
function walk(project: Project, state: WalkState, entry: FlowNode | null): SimSnapshot {
  let node: FlowNode | null = entry;
  for (let steps = 0; steps < STEP_LIMIT; steps++) {
    if (!node) {
      // Current branch is exhausted: emerge from containers until one of
      // them has somewhere to go.
      while (state.stack.length > 0) {
        const containerId = state.stack[state.stack.length - 1]!;
        state.stack = state.stack.slice(0, -1);
        const container = nodeById(project, containerId);
        if (!container) continue;
        try {
          state.vars = executeInstruction(container.outputPinScript, state.vars);
        } catch (e) {
          return fail(snapshotOf(state), errMsg(e, container));
        }
        const conns = validOutgoing(project, state.vars, container, 0);
        const first = conns[0];
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
      const kids = childrenOf(project, node.id);
      if (kids.length > 0) {
        state.stack = [...state.stack, node.id];
        node = startNodes(project, node.id)[0] ?? null;
        continue;
      }
      node = firstTarget(project, state, node);
      continue;
    }

    switch (node.kind) {
      case 'dialogue_fragment': {
        pushTranscript(state, project, node);
        const conns = validOutgoing(project, state.vars, node, 0);
        const choices: SimChoice[] =
          conns.length > 0
            ? conns.map((c) => ({
                connectionId: c.id,
                targetId: c.targetId,
                label: c.label.trim() || choiceLabel(project, nodeById(project, c.targetId)!),
              }))
            : // Dead-ends still offer a Continue that emerges from the
              // enclosing container (or ends the flow at the top level).
              [{ connectionId: null, targetId: '', label: 'Continue' }];
        return { ...snapshotOf(state), node, choices, ended: false, error: null };
      }
      case 'hub': {
        const conns = validOutgoing(project, state.vars, node, 0);
        if (conns.length === 0) {
          node = leaveAndEmerge(project, state, node);
          continue;
        }
        if (conns.length === 1) {
          node = follow(project, state, node, conns[0]!);
          continue;
        }
        const choices: SimChoice[] = conns.map((c) => ({
          connectionId: c.id,
          targetId: c.targetId,
          label: c.label.trim() || choiceLabel(project, nodeById(project, c.targetId)!),
        }));
        return { ...snapshotOf(state), node, choices, ended: false, error: null };
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
        const conns = validOutgoing(project, state.vars, node, pin);
        const first = conns[0];
        if (!first) {
          node = leaveAndEmerge(project, state, node);
          continue;
        }
        node = follow(project, state, node, first);
        continue;
      }
      case 'jump': {
        try {
          state.vars = executeInstruction(node.outputPinScript, state.vars);
        } catch (e) {
          return fail(snapshotOf(state), errMsg(e, node));
        }
        const target = nodeById(project, node.targetId);
        if (!target) {
          return fail(snapshotOf(state), `Jump "${node.displayName}" has no target`);
        }
        // Re-align the container stack to the target's ancestry so that
        // emerging after the jump behaves correctly.
        state.stack = ancestryOf(project, target);
        node = target;
        continue;
      }
      default:
        node = firstTarget(project, state, node);
        continue;
    }
  }
  return fail(snapshotOf(state), 'Flow did not settle after 1000 steps (possible loop of instructions)');

  function snapshotOf(s: WalkState): SimSnapshot {
    return {
      vars: s.vars,
      stack: s.stack,
      node: null,
      choices: [],
      transcript: s.transcript,
      ended: false,
      error: null,
    };
  }
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

/** Executes the node's output pin then follows its first valid connection. */
function firstTarget(project: Project, state: WalkState, node: FlowNode): FlowNode | null {
  const conns = validOutgoing(project, state.vars, node, 0);
  const first = conns[0];
  if (!first) return leaveAndEmerge(project, state, node);
  return follow(project, state, node, first);
}

function follow(project: Project, state: WalkState, source: FlowNode, conn: Connection): FlowNode | null {
  state.vars = executeInstruction(source.outputPinScript, state.vars);
  return nodeById(project, conn.targetId) ?? null;
}

/** Branch is done at `node`: run its output pin, then signal emersion. */
function leaveAndEmerge(project: Project, state: WalkState, node: FlowNode): null {
  state.vars = executeInstruction(node.outputPinScript, state.vars);
  return null;
}

export function startSimulation(project: Project, startNodeId?: string): SimSnapshot {
  const vars = initialVarEnv(project);
  const start = startNodeId ? nodeById(project, startNodeId) : startNodes(project, null)[0];
  if (!start) {
    return {
      vars,
      stack: [],
      node: null,
      choices: [],
      transcript: [],
      ended: true,
      error: 'This flow has no nodes yet. Add a node to play.',
    };
  }
  const state: WalkState = {
    vars,
    stack: startNodeId ? ancestryOf(project, start) : [],
    transcript: [],
  };
  try {
    return walk(project, state, start);
  } catch (e) {
    return fail(
      { vars: state.vars, stack: state.stack, node: null, choices: [], transcript: state.transcript, ended: false, error: null },
      e instanceof Error ? e.message : String(e)
    );
  }
}

export function choose(project: Project, snapshot: SimSnapshot, choice: SimChoice): SimSnapshot {
  if (snapshot.ended || !snapshot.node) return snapshot;
  const state: WalkState = {
    vars: snapshot.vars,
    stack: snapshot.stack,
    transcript: snapshot.transcript,
  };
  try {
    state.vars = executeInstruction(snapshot.node.outputPinScript, state.vars);
    if (!choice.targetId) {
      // Synthetic "Continue" on a dead-end: emerge from containers.
      return walk(project, state, null);
    }
    const target = nodeById(project, choice.targetId);
    if (!target) return fail(snapshot, 'The chosen branch no longer exists');
    return walk(project, state, target);
  } catch (e) {
    return fail(snapshot, errMsg(e, snapshot.node));
  }
}
