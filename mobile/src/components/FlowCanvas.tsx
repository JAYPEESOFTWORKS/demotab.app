import React, { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { Connection, FlowNode, Project } from '../types';
import { NODE_KIND_COLOR, NODE_KIND_LABEL, childrenOf, connectionsIn, entityById, isContainer } from '../model';
import { theme } from '../theme';

export const NODE_W = 170;
export const NODE_H = 76;
export const CANVAS_W = 4000;
export const CANVAS_H = 4000;

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------

interface NodeViewProps {
  node: FlowNode;
  selected: boolean;
  linkSource: boolean;
  speakerName: string | null;
  childCount: number;
  scaleRef: React.MutableRefObject<number>;
  onTap: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const NodeView = React.memo(function NodeView(props: NodeViewProps) {
  const propsRef = useRef(props);
  propsRef.current = props;
  const dragStart = useRef({ x: 0, y: 0 });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = { x: propsRef.current.node.x, y: propsRef.current.node.y };
      },
      onPanResponderMove: (_evt, gs) => {
        const scale = propsRef.current.scaleRef.current;
        if (Math.abs(gs.dx) + Math.abs(gs.dy) < 4) return;
        propsRef.current.onMove(
          propsRef.current.node.id,
          clamp(dragStart.current.x + gs.dx / scale, 0, CANVAS_W - NODE_W),
          clamp(dragStart.current.y + gs.dy / scale, 0, CANVAS_H - NODE_H)
        );
      },
      onPanResponderRelease: (_evt, gs) => {
        if (Math.abs(gs.dx) < 6 && Math.abs(gs.dy) < 6) {
          propsRef.current.onTap(propsRef.current.node.id);
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const { node, selected, linkSource, speakerName, childCount } = props;
  const barColor = node.color ?? NODE_KIND_COLOR[node.kind];
  const container = isContainer(node.kind);
  const snippet =
    node.kind === 'condition' || node.kind === 'instruction'
      ? node.text
      : node.kind === 'jump'
        ? ''
        : node.text;

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.node,
        { left: node.x, top: node.y },
        container && styles.nodeContainerKind,
        selected && styles.nodeSelected,
        linkSource && styles.nodeLinkSource,
      ]}
    >
      <View style={[styles.nodeBar, { backgroundColor: barColor }]}>
        <Text style={styles.nodeKind} numberOfLines={1}>
          {NODE_KIND_LABEL[node.kind]}
          {container ? `  ▸ ${childCount}` : ''}
        </Text>
      </View>
      <View style={styles.nodeBody}>
        <Text style={styles.nodeName} numberOfLines={1}>
          {node.displayName || 'Untitled'}
        </Text>
        {speakerName ? (
          <Text style={[styles.nodeSnippet, { color: barColor }]} numberOfLines={1}>
            {speakerName}
          </Text>
        ) : null}
        {snippet ? (
          <Text style={styles.nodeSnippet} numberOfLines={speakerName ? 1 : 2}>
            {snippet}
          </Text>
        ) : null}
        {node.requiresItems.length || node.grantsItems.length || node.isEnding ? (
          <View style={styles.badgeRow}>
            {node.requiresItems.length ? (
              <Text style={[styles.badge, { color: theme.accent }]}>🔒 {node.requiresItems.length}</Text>
            ) : null}
            {node.grantsItems.length ? (
              <Text style={[styles.badge, { color: theme.ok }]}>🎁 {node.grantsItems.length}</Text>
            ) : null}
            {node.isEnding ? <Text style={[styles.badge, { color: '#e0b84a' }]}>★ end</Text> : null}
          </View>
        ) : null}
      </View>
      {node.kind === 'condition' ? (
        <>
          <View style={[styles.pinDot, { top: NODE_H * 0.32 - 4, backgroundColor: theme.ok }]} />
          <View style={[styles.pinDot, { top: NODE_H * 0.72 - 4, backgroundColor: theme.danger }]} />
        </>
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------------

interface FlowCanvasProps {
  project: Project;
  parentId: string | null;
  selectedId: string | null;
  linkFrom: { nodeId: string; pin: 0 | 1 } | null;
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  onTapNode: (id: string) => void;
  onTapCanvas: () => void;
  onMoveNode: (id: string, x: number, y: number) => void;
}

export function FlowCanvas(props: FlowCanvasProps) {
  const { project, parentId, selectedId, linkFrom, view } = props;

  const propsRef = useRef(props);
  propsRef.current = props;
  const scaleRef = useRef(view.scale);
  scaleRef.current = view.scale;

  const containerOrigin = useRef({ x: 0, y: 0 });
  const containerRef = useRef<View>(null);
  const pinch = useRef<{ scale: number; x: number; y: number; dist: number; midX: number; midY: number } | null>(null);
  const panAnchor = useRef({ x: 0, y: 0 });
  const didPinch = useRef(false);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const v = propsRef.current.view;
        panAnchor.current = { x: v.x, y: v.y };
        pinch.current = null;
        didPinch.current = false;
      },
      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;
        const v = propsRef.current.view;
        if (touches.length >= 2) {
          didPinch.current = true;
          const a = touches[0]!;
          const b = touches[1]!;
          const midX = (a.pageX + b.pageX) / 2 - containerOrigin.current.x;
          const midY = (a.pageY + b.pageY) / 2 - containerOrigin.current.y;
          const dist = Math.max(20, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
          if (!pinch.current) {
            pinch.current = { scale: v.scale, x: v.x, y: v.y, dist, midX, midY };
          }
          const p = pinch.current;
          const s = clamp((p.scale * dist) / p.dist, 0.25, 2.5);
          const cx = (p.midX - p.x) / p.scale;
          const cy = (p.midY - p.y) / p.scale;
          propsRef.current.onViewChange({ x: midX - cx * s, y: midY - cy * s, scale: s });
        } else {
          if (pinch.current) {
            pinch.current = null;
            panAnchor.current = { x: v.x - gs.dx, y: v.y - gs.dy };
          }
          propsRef.current.onViewChange({
            x: panAnchor.current.x + gs.dx,
            y: panAnchor.current.y + gs.dy,
            scale: v.scale,
          });
        }
      },
      onPanResponderRelease: (_evt, gs) => {
        if (!didPinch.current && Math.abs(gs.dx) < 6 && Math.abs(gs.dy) < 6) {
          propsRef.current.onTapCanvas();
        }
      },
    })
  ).current;

  const nodes = useMemo(() => childrenOf(project, parentId), [project, parentId]);
  const connections = useMemo(() => connectionsIn(project, parentId), [project, parentId]);
  const nodeMap = useMemo(() => {
    const m = new Map<string, FlowNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const gridLines = useMemo(() => {
    const lines: React.ReactElement[] = [];
    for (let x = 0; x <= CANVAS_W; x += 150) {
      lines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={CANVAS_H} stroke={theme.grid} strokeWidth={1} />);
    }
    for (let y = 0; y <= CANVAS_H; y += 150) {
      lines.push(<Line key={`h${y}`} x1={0} y1={y} x2={CANVAS_W} y2={y} stroke={theme.grid} strokeWidth={1} />);
    }
    return lines;
  }, []);

  const renderConnection = (c: Connection) => {
    const source = nodeMap.get(c.sourceId);
    const target = nodeMap.get(c.targetId);
    if (!source || !target) return null;
    const sy =
      source.kind === 'condition'
        ? source.y + NODE_H * (c.sourcePin === 0 ? 0.32 : 0.72)
        : source.y + NODE_H / 2;
    const sx = source.x + NODE_W;
    const tx = target.x;
    const ty = target.y + NODE_H / 2;
    const bend = Math.max(40, Math.min(90, Math.abs(tx - sx) / 2));
    const d = `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`;
    const color =
      source.kind === 'condition' ? (c.sourcePin === 0 ? theme.ok : theme.danger) : '#5a6472';
    return (
      <React.Fragment key={c.id}>
        <Path d={d} stroke={color} strokeWidth={2} fill="none" />
        <Path d={`M ${tx} ${ty} l -9 -5 l 0 10 z`} fill={color} />
        {c.label ? (
          <SvgText
            x={(sx + tx) / 2}
            y={(sy + ty) / 2 - 6}
            fill={theme.dim}
            fontSize={11}
            textAnchor="middle"
          >
            {c.label}
          </SvgText>
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <View
      ref={containerRef}
      style={styles.viewport}
      onLayout={() => {
        containerRef.current?.measureInWindow((x, y) => {
          containerOrigin.current = { x, y };
        });
      }}
      {...responder.panHandlers}
    >
      <View
        style={[
          styles.canvas,
          {
            transform: [{ translateX: view.x }, { translateY: view.y }, { scale: view.scale }],
            transformOrigin: 'top left',
          },
        ]}
      >
        <Svg width={CANVAS_W} height={CANVAS_H} style={StyleSheet.absoluteFill} pointerEvents="none">
          {gridLines}
          {connections.map(renderConnection)}
        </Svg>
        {nodes.map((n) => (
          <NodeView
            key={n.id}
            node={n}
            selected={selectedId === n.id}
            linkSource={linkFrom?.nodeId === n.id}
            speakerName={
              n.kind === 'dialogue_fragment' ? (entityById(project, n.speakerId)?.name ?? null) : null
            }
            childCount={isContainer(n.kind) ? childrenOf(project, n.id).length : 0}
            scaleRef={scaleRef}
            onTap={props.onTapNode}
            onMove={props.onMoveNode}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: theme.canvas },
  canvas: { position: 'absolute', left: 0, top: 0, width: CANVAS_W, height: CANVAS_H },
  node: {
    position: 'absolute',
    width: NODE_W,
    minHeight: NODE_H,
    borderRadius: 10,
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  nodeContainerKind: { borderStyle: 'solid', borderWidth: 2 },
  nodeSelected: { borderColor: theme.accent, shadowColor: theme.accent, elevation: 6 },
  nodeLinkSource: { borderColor: theme.ok },
  nodeBar: { paddingHorizontal: 8, paddingVertical: 3 },
  nodeKind: { color: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  nodeBody: { paddingHorizontal: 8, paddingVertical: 6 },
  nodeName: { color: theme.text, fontSize: 13, fontWeight: '600' },
  nodeSnippet: { color: theme.dim, fontSize: 11, marginTop: 2, lineHeight: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: { fontSize: 10, fontWeight: '700' },
  pinDot: {
    position: 'absolute',
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
