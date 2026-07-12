import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Connection, FlowNode, NodeKind, Project } from '../types';
import {
  NODE_KIND_COLOR,
  NODE_KIND_LABEL,
  childrenOf,
  createNode,
  deleteNodeDeep,
  isContainer,
  makeId,
  nodeById,
} from '../model';
import { theme } from '../theme';
import { Btn, SheetModal } from '../components/ui';
import { CANVAS_H, CANVAS_W, FlowCanvas, NODE_H, NODE_W, ViewTransform } from '../components/FlowCanvas';
import { NodeEditorSheet } from '../components/NodeEditorSheet';

const ADDABLE: { kind: NodeKind; hint: string }[] = [
  { kind: 'dialogue_fragment', hint: 'A single spoken line; becomes a player choice when branched to.' },
  { kind: 'dialogue', hint: 'Container for a conversation. Double-tap to open it.' },
  { kind: 'flow_fragment', hint: 'Container for any sub-flow (a quest, a chapter…).' },
  { kind: 'hub', hint: 'Routing point. Multiple outputs become player choices.' },
  { kind: 'condition', hint: 'Branches on an expression: green pin = true, red pin = false.' },
  { kind: 'instruction', hint: 'Runs a script (set variables), then continues.' },
  { kind: 'media_beat', hint: 'Placeholder for a rich interactive moment you’ll build later.' },
  { kind: 'jump', hint: 'Continues at any other node in the project.' },
];

interface Props {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
  onPlayFrom: (nodeId: string | null) => void;
}

export function FlowScreen({ project, updateProject, onPlayFrom }: Props) {
  const { width, height } = useWindowDimensions();
  const [containerStack, setContainerStack] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<{ nodeId: string; pin: 0 | 1 } | null>(null);
  const [view, setView] = useState<ViewTransform>({ x: 40, y: 40, scale: 0.9 });
  const [showAdd, setShowAdd] = useState(false);
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const lastTap = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const parentId = containerStack[containerStack.length - 1] ?? null;
  const selected = nodeById(project, selectedId);

  const breadcrumbs = useMemo(() => {
    const parts: { id: string | null; name: string }[] = [{ id: null, name: 'Flow' }];
    for (const id of containerStack) {
      parts.push({ id, name: nodeById(project, id)?.displayName ?? '…' });
    }
    return parts;
  }, [containerStack, project]);

  const fitView = useCallback(
    (scopeParent: string | null, focusId?: string) => {
      const scoped = childrenOf(project, scopeParent);
      const focus = focusId ? nodeById(project, focusId) : undefined;
      const anchor = focus ?? scoped[0];
      if (!anchor) {
        setView({ x: 40, y: 40, scale: 0.9 });
        return;
      }
      const scale = 0.9;
      setView({
        x: width / 2 - (anchor.x + NODE_W / 2) * scale,
        y: height / 3 - (anchor.y + NODE_H / 2) * scale,
        scale,
      });
    },
    [project, width, height]
  );

  const enterContainer = useCallback(
    (id: string) => {
      setContainerStack((s) => [...s, id]);
      setSelectedId(null);
      setLinkFrom(null);
      const first = childrenOf(project, id)[0];
      setView({
        x: first ? width / 2 - (first.x + NODE_W / 2) * 0.9 : 40,
        y: first ? height / 3 - (first.y + NODE_H / 2) * 0.9 : 40,
        scale: 0.9,
      });
    },
    [project, width, height]
  );

  const goToCrumb = (index: number) => {
    setContainerStack((s) => s.slice(0, index));
    setSelectedId(null);
    setLinkFrom(null);
  };

  const handleTapNode = useCallback(
    (id: string) => {
      const node = nodeById(project, id);
      if (!node) return;

      if (linkFrom) {
        if (linkFrom.nodeId === id) {
          setLinkFrom(null);
          return;
        }
        updateProject((p) => {
          const exists = p.connections.some(
            (c) => c.sourceId === linkFrom.nodeId && c.targetId === id && c.sourcePin === linkFrom.pin
          );
          if (exists) return p;
          const conn: Connection = {
            id: makeId(),
            parentId,
            sourceId: linkFrom.nodeId,
            sourcePin: linkFrom.pin,
            targetId: id,
            label: '',
          };
          return { ...p, connections: [...p.connections, conn] };
        });
        setLinkFrom(null);
        setSelectedId(id);
        return;
      }

      const now = Date.now();
      const isDoubleTap = lastTap.current.id === id && now - lastTap.current.time < 350;
      lastTap.current = { id, time: now };
      if (isDoubleTap && isContainer(node.kind)) {
        enterContainer(id);
        return;
      }
      setSelectedId((s) => (s === id ? null : id));
    },
    [project, linkFrom, parentId, updateProject, enterContainer]
  );

  const handleMoveNode = useCallback(
    (id: string, x: number, y: number) => {
      updateProject((p) => ({
        ...p,
        nodes: p.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      }));
    },
    [updateProject]
  );

  const addNode = (kind: NodeKind) => {
    const x = Math.min(CANVAS_W - NODE_W - 20, Math.max(20, (width / 2 - view.x) / view.scale - NODE_W / 2));
    const y = Math.min(CANVAS_H - NODE_H - 20, Math.max(20, (height / 3 - view.y) / view.scale));
    const node = createNode(kind, parentId, x, y);
    updateProject((p) => ({ ...p, nodes: [...p.nodes, node] }));
    setShowAdd(false);
    setSelectedId(node.id);
    setEditorNodeId(node.id);
  };

  const confirmDeleteNode = (id: string) => {
    const node = nodeById(project, id);
    if (!node) return;
    const kids = isContainer(node.kind) ? childrenOf(project, id).length : 0;
    Alert.alert(
      'Delete node',
      kids > 0
        ? `Delete "${node.displayName}" and the ${kids} node(s) inside it?`
        : `Delete "${node.displayName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            updateProject((p) => deleteNodeDeep(p, id));
            setSelectedId(null);
            setEditorNodeId(null);
          },
        },
      ]
    );
  };

  const patchNode = useCallback(
    (nodeId: string, patch: Partial<FlowNode>) => {
      updateProject((p) => ({
        ...p,
        nodes: p.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      }));
    },
    [updateProject]
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.id ?? 'root'}>
                {i > 0 ? <Text style={{ color: theme.faint, marginHorizontal: 4 }}>/</Text> : null}
                <Pressable onPress={() => goToCrumb(i)} disabled={i === breadcrumbs.length - 1}>
                  <Text
                    style={{
                      color: i === breadcrumbs.length - 1 ? theme.text : theme.accent,
                      fontSize: 14,
                      fontWeight: i === breadcrumbs.length - 1 ? '700' : '400',
                    }}
                    numberOfLines={1}
                  >
                    {b.name}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
        <Btn label="Fit" small onPress={() => fitView(parentId)} />
        <Btn label="+ Node" small kind="primary" onPress={() => setShowAdd(true)} />
      </View>

      {linkFrom ? (
        <View style={styles.linkBanner}>
          <Text style={{ color: theme.text, fontSize: 13, flex: 1 }}>
            Tap a target node to connect
            {linkFrom.pin === 1 ? ' (false branch)' : ''}…
          </Text>
          <Btn label="Cancel" small onPress={() => setLinkFrom(null)} />
        </View>
      ) : null}

      <FlowCanvas
        project={project}
        parentId={parentId}
        selectedId={selectedId}
        linkFrom={linkFrom}
        view={view}
        onViewChange={setView}
        onTapNode={handleTapNode}
        onTapCanvas={() => {
          setSelectedId(null);
          setLinkFrom(null);
        }}
        onMoveNode={handleMoveNode}
      />

      {selected ? (
        <View style={styles.actionBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 10 }}>
              <Btn label="Edit" small kind="primary" onPress={() => setEditorNodeId(selected.id)} />
              {isContainer(selected.kind) ? (
                <Btn label="Open" small onPress={() => enterContainer(selected.id)} />
              ) : null}
              {selected.kind === 'condition' ? (
                <>
                  <Btn label="Link ✓" small onPress={() => setLinkFrom({ nodeId: selected.id, pin: 0 })} />
                  <Btn label="Link ✗" small onPress={() => setLinkFrom({ nodeId: selected.id, pin: 1 })} />
                </>
              ) : (
                <Btn label="Link" small onPress={() => setLinkFrom({ nodeId: selected.id, pin: 0 })} />
              )}
              <Btn label="Play here" small onPress={() => onPlayFrom(selected.id)} />
              <Btn label="Delete" small kind="danger" onPress={() => confirmDeleteNode(selected.id)} />
            </View>
          </ScrollView>
        </View>
      ) : null}

      <SheetModal visible={showAdd} title="Add node" onClose={() => setShowAdd(false)}>
        {ADDABLE.map(({ kind, hint }) => (
          <Pressable key={kind} style={styles.addRow} onPress={() => addNode(kind)}>
            <View style={[styles.addSwatch, { backgroundColor: NODE_KIND_COLOR[kind] }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
                {NODE_KIND_LABEL[kind]}
              </Text>
              <Text style={{ color: theme.dim, fontSize: 12, marginTop: 2 }}>{hint}</Text>
            </View>
          </Pressable>
        ))}
      </SheetModal>

      <NodeEditorSheet
        project={project}
        nodeId={editorNodeId}
        onClose={() => setEditorNodeId(null)}
        onPatchNode={patchNode}
        onDeleteNode={confirmDeleteNode}
        onDeleteConnection={(connId) =>
          updateProject((p) => ({ ...p, connections: p.connections.filter((c) => c.id !== connId) }))
        }
        onLabelConnection={(connId, label) =>
          updateProject((p) => ({
            ...p,
            connections: p.connections.map((c) => (c.id === connId ? { ...c, label } : c)),
          }))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.panel,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  linkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1f3d2b',
    borderBottomWidth: 1,
    borderBottomColor: theme.ok,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    paddingVertical: 8,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  addSwatch: { width: 14, height: 14, borderRadius: 4 },
});
