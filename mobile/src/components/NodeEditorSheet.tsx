import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { FlowNode, Project } from '../types';
import { NODE_KIND_COLOR, NODE_KIND_LABEL, isContainer, nodeById, outgoing } from '../model';
import { validateScript } from '../script/engine';
import { ENTITY_COLORS, theme } from '../theme';
import { Btn, ColorDots, Field, Row, SheetModal } from './ui';

interface Props {
  project: Project;
  nodeId: string | null;
  onClose: () => void;
  onPatchNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onLabelConnection: (connectionId: string, label: string) => void;
}

export function NodeEditorSheet({
  project,
  nodeId,
  onClose,
  onPatchNode,
  onDeleteNode,
  onDeleteConnection,
  onLabelConnection,
}: Props) {
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const node = nodeId ? nodeById(project, nodeId) : undefined;
  if (!node) return null;

  const patch = (p: Partial<FlowNode>) => onPatchNode(node.id, p);
  const conns = outgoing(project, node.id);
  const scriptLabel = node.kind === 'condition' ? 'Expression' : 'Script';

  const jumpCandidates =
    node.kind === 'jump' ? project.nodes.filter((n) => n.id !== node.id) : [];

  return (
    <SheetModal
      visible={!!nodeId}
      title={`${NODE_KIND_LABEL[node.kind]}`}
      onClose={onClose}
      footer={
        <>
          <View style={{ flex: 1 }}>
            <Btn
              label="Delete node"
              kind="danger"
              onPress={() => {
                onDeleteNode(node.id);
                onClose();
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Btn label="Done" kind="primary" onPress={onClose} />
          </View>
        </>
      }
    >
      <Field label="Name" value={node.displayName} onChangeText={(t) => patch({ displayName: t })} />

      {node.kind === 'dialogue_fragment' ? (
        <>
          <Text style={sub.label}>Speaker</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <Chip
              label="None"
              active={!node.speakerId}
              color={theme.faint}
              onPress={() => patch({ speakerId: null })}
            />
            {project.entities.map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                active={node.speakerId === e.id}
                color={e.color}
                onPress={() => patch({ speakerId: e.id })}
              />
            ))}
          </View>
          <Field
            label="Text (spoken line)"
            value={node.text}
            onChangeText={(t) => patch({ text: t })}
            multiline
          />
          <Field
            label="Menu text (shown as a choice)"
            value={node.menuText}
            onChangeText={(t) => patch({ menuText: t })}
            placeholder="Defaults to the text above"
          />
          <Field
            label="Stage directions"
            value={node.stageDirections}
            onChangeText={(t) => patch({ stageDirections: t })}
          />
        </>
      ) : null}

      {node.kind === 'condition' || node.kind === 'instruction' ? (
        <Field
          label={scriptLabel}
          value={node.text}
          onChangeText={(t) => patch({ text: t })}
          placeholder={
            node.kind === 'condition' ? 'inventory.gold >= 10' : 'inventory.gold -= 10; story.done = true'
          }
          multiline
          mono
          error={validateScript(node.text)}
        />
      ) : null}

      {isContainer(node.kind) || node.kind === 'hub' ? (
        <Field
          label="Description"
          value={node.text}
          onChangeText={(t) => patch({ text: t })}
          multiline
        />
      ) : null}

      {node.kind === 'media_beat' ? (
        <>
          <View style={sub.hintBox}>
            <Text style={sub.hintText}>
              A media beat marks where rich interactive content goes in the finished game — a drone
              view, a video clip, a mini-game. Describe it here; the player sees this text as a
              placeholder while you design the story.
            </Text>
          </View>
          <Field
            label="What the player sees / does"
            value={node.text}
            onChangeText={(t) => patch({ text: t })}
            placeholder="Player flies the drone over the ravine and spots the wreck…"
            multiline
          />
        </>
      ) : null}

      {node.kind === 'jump' ? (
        <View style={{ marginBottom: 14 }}>
          <Text style={sub.label}>Jump target</Text>
          <Pressable style={sub.pickerButton} onPress={() => setShowTargetPicker((s) => !s)}>
            <Text style={{ color: node.targetId ? theme.text : theme.faint, fontSize: 15 }}>
              {nodeById(project, node.targetId)?.displayName ?? 'Tap to choose a target…'}
            </Text>
          </Pressable>
          {showTargetPicker
            ? jumpCandidates.map((n) => (
                <Pressable
                  key={n.id}
                  style={sub.pickerRow}
                  onPress={() => {
                    patch({ targetId: n.id });
                    setShowTargetPicker(false);
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: n.color ?? NODE_KIND_COLOR[n.kind],
                    }}
                  />
                  <Text style={{ color: theme.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {n.displayName || 'Untitled'}
                  </Text>
                  <Text style={{ color: theme.faint, fontSize: 11 }}>{NODE_KIND_LABEL[n.kind]}</Text>
                </Pressable>
              ))
            : null}
        </View>
      ) : null}

      <Field
        label="Input pin condition (blocks entry when false)"
        value={node.inputPinScript}
        onChangeText={(t) => patch({ inputPinScript: t })}
        placeholder="Empty = always allowed"
        mono
        error={validateScript(node.inputPinScript)}
      />
      <Field
        label="Output pin script (runs when leaving)"
        value={node.outputPinScript}
        onChangeText={(t) => patch({ outputPinScript: t })}
        placeholder="Empty = no effect"
        mono
        error={validateScript(node.outputPinScript)}
      />

      <Text style={sub.label}>Requires items (blocks entry until held)</Text>
      {project.items.length === 0 ? (
        <Text style={sub.emptyHint}>
          No items yet. Add them under State › Items to gate this node on the player holding something.
        </Text>
      ) : (
        <View style={sub.chipWrap}>
          {project.items.map((item) => {
            const active = node.requiresItems.includes(item.id);
            return (
              <Chip
                key={item.id}
                label={item.name}
                active={active}
                color={theme.accent}
                onPress={() =>
                  patch({
                    requiresItems: active
                      ? node.requiresItems.filter((id) => id !== item.id)
                      : [...node.requiresItems, item.id],
                  })
                }
              />
            );
          })}
        </View>
      )}

      {project.items.length > 0 ? (
        <>
          <Text style={sub.label}>Grants items (given when leaving)</Text>
          <View style={sub.chipWrap}>
            {project.items.map((item) => {
              const active = node.grantsItems.includes(item.id);
              return (
                <Chip
                  key={item.id}
                  label={item.name}
                  active={active}
                  color={theme.ok}
                  onPress={() =>
                    patch({
                      grantsItems: active
                        ? node.grantsItems.filter((id) => id !== item.id)
                        : [...node.grantsItems, item.id],
                    })
                  }
                />
              );
            })}
          </View>
        </>
      ) : null}

      <Pressable style={sub.endingRow} onPress={() => patch({ isEnding: !node.isEnding })}>
        <View style={[sub.checkbox, node.isEnding && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
          {node.isEnding ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>Story ending</Text>
          <Text style={{ color: theme.dim, fontSize: 12, marginTop: 1 }}>
            Reaching this node completes the whole story (the goal). Combine with “requires items” so it
            only opens once every piece is collected.
          </Text>
        </View>
      </Pressable>

      <Text style={sub.label}>Color</Text>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <ColorDots colors={ENTITY_COLORS} value={node.color} onChange={(c) => patch({ color: c })} />
        </View>
        <Btn label="Default" small onPress={() => patch({ color: null })} />
      </Row>

      <Text style={sub.label}>Outgoing connections</Text>
      {conns.length === 0 ? (
        <Text style={{ color: theme.faint, fontSize: 13, marginBottom: 10 }}>
          None. Select this node on the canvas and tap Link to connect it.
        </Text>
      ) : (
        conns.map((c) => {
          const target = nodeById(project, c.targetId);
          return (
            <View key={c.id} style={sub.connRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 13 }} numberOfLines={1}>
                  → {target?.displayName ?? '(missing)'}
                  {node.kind === 'condition' ? (c.sourcePin === 0 ? '  (true)' : '  (false)') : ''}
                </Text>
                <TextInput
                  value={c.label}
                  onChangeText={(t) => onLabelConnection(c.id, t)}
                  placeholder="Label (optional)"
                  placeholderTextColor={theme.faint}
                  style={sub.connLabelInput}
                />
              </View>
              <Btn label="Remove" small kind="danger" onPress={() => onDeleteConnection(c.id)} />
            </View>
          );
        })
      )}
    </SheetModal>
  );
}

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: active ? color : theme.border,
        backgroundColor: active ? `${color}33` : theme.panel,
      }}
    >
      <Text style={{ color: active ? theme.text : theme.dim, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const sub = {
  label: {
    color: theme.dim,
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginBottom: 14 },
  emptyHint: { color: theme.faint, fontSize: 12, marginBottom: 14, lineHeight: 17 },
  hintBox: {
    backgroundColor: '#2a1f16',
    borderWidth: 1,
    borderColor: '#e07b39',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  hintText: { color: '#f0c9a8', fontSize: 12, lineHeight: 17 },
  endingRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pickerButton: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  connRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  connLabelInput: {
    color: theme.text,
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    marginTop: 4,
  },
};
