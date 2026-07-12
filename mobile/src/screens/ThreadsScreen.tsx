import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FlowNode, Project, StoryThread } from '../types';
import { NODE_KIND_LABEL, childrenOf, createStoryThread, entityById, nodeById } from '../model';
import { theme } from '../theme';
import { Btn, EmptyState, Field, SheetModal } from '../components/ui';

interface Props {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
}

/** Reasonable start-node candidates: top-level nodes and containers. */
function startCandidates(project: Project): FlowNode[] {
  return childrenOf(project, null);
}

export function ThreadsScreen({ project, updateProject }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const editing = project.threads.find((t) => t.id === editingId);

  const patch = (id: string, p: Partial<StoryThread>) =>
    updateProject((proj) => ({
      ...proj,
      threads: proj.threads.map((t) => (t.id === id ? { ...t, ...p } : t)),
    }));

  const addThread = () => {
    const thread = createStoryThread(`Thread ${project.threads.length + 1}`, project.threads.length);
    updateProject((p) => ({ ...p, threads: [...p.threads, thread] }));
    setEditingId(thread.id);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.introBox}>
        <Text style={styles.introText}>
          Threads are parallel storylines the player switches between. They share all variables and
          items, so progress in one can unblock another. With no threads, the story plays as a single
          flow from its first node.
        </Text>
      </View>
      <FlatList
        data={project.threads}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{project.threads.length} thread(s)</Text>
            <Btn label="+ Thread" small kind="primary" onPress={addThread} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No threads yet"
            hint="Add a thread per character or storyline and point each at the node where it begins."
          />
        }
        renderItem={({ item }) => {
          const character = entityById(project, item.characterId);
          const start = nodeById(project, item.startNodeId);
          return (
            <Pressable style={styles.card} onPress={() => setEditingId(item.id)}>
              <View style={[styles.swatch, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {character ? character.name : 'No character'} · starts at{' '}
                  {start ? start.displayName || 'Untitled' : '⚠ not set'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      {editing ? (
        <SheetModal
          visible
          title={editing.name || 'Thread'}
          onClose={() => {
            setEditingId(null);
            setShowStartPicker(false);
          }}
          footer={
            <>
              <View style={{ flex: 1 }}>
                <Btn
                  label="Delete thread"
                  kind="danger"
                  onPress={() => {
                    updateProject((p) => ({ ...p, threads: p.threads.filter((t) => t.id !== editing.id) }));
                    setEditingId(null);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="Done" kind="primary" onPress={() => setEditingId(null)} />
              </View>
            </>
          }
        >
          <Field label="Name" value={editing.name} onChangeText={(t) => patch(editing.id, { name: t })} />

          <Text style={styles.subLabel}>Character</Text>
          <View style={styles.chipWrap}>
            <Chip
              label="None"
              active={!editing.characterId}
              color={theme.faint}
              onPress={() => patch(editing.id, { characterId: null })}
            />
            {project.entities.map((e) => (
              <Chip
                key={e.id}
                label={e.name}
                active={editing.characterId === e.id}
                color={e.color}
                onPress={() => patch(editing.id, { characterId: e.id })}
              />
            ))}
          </View>

          <Text style={styles.subLabel}>Starts at node</Text>
          <Pressable style={styles.pickerButton} onPress={() => setShowStartPicker((s) => !s)}>
            <Text style={{ color: editing.startNodeId ? theme.text : theme.faint, fontSize: 15 }}>
              {nodeById(project, editing.startNodeId)?.displayName ?? 'Tap to choose a start node…'}
            </Text>
          </Pressable>
          {showStartPicker
            ? startCandidates(project).map((n) => (
                <Pressable
                  key={n.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    patch(editing.id, { startNodeId: n.id });
                    setShowStartPicker(false);
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {n.displayName || 'Untitled'}
                  </Text>
                  <Text style={{ color: theme.faint, fontSize: 11 }}>{NODE_KIND_LABEL[n.kind]}</Text>
                </Pressable>
              ))
            : null}
          {startCandidates(project).length === 0 ? (
            <Text style={styles.emptyHint}>Add a top-level node in the Flow tab first.</Text>
          ) : null}
        </SheetModal>
      ) : null}
    </View>
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

const styles = StyleSheet.create({
  introBox: { paddingHorizontal: 14, paddingTop: 12 },
  introText: { color: theme.dim, fontSize: 12, lineHeight: 17 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: { color: theme.dim, fontSize: 13, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  swatch: { width: 6, borderRadius: 3 },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: theme.dim, fontSize: 12, marginTop: 3 },
  subLabel: {
    color: theme.dim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pickerButton: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  emptyHint: { color: theme.faint, fontSize: 12, marginTop: 8 },
});
