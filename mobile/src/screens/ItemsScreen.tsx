import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Item, Project } from '../types';
import { createItem, slugifyKey } from '../model';
import { theme } from '../theme';
import { Btn, EmptyState, Field, SheetModal } from '../components/ui';

interface Props {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
}

/** Nodes that grant or require an item, for the "used by" hint. */
function usage(project: Project, itemId: string): { grants: number; requires: number } {
  let grants = 0;
  let requires = 0;
  for (const n of project.nodes) {
    if (n.grantsItems.includes(itemId)) grants++;
    if (n.requiresItems.includes(itemId)) requires++;
  }
  return { grants, requires };
}

export function ItemsScreen({ project, updateProject }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyEdited, setKeyEdited] = useState(false);
  const editing = project.items.find((i) => i.id === editingId);

  const patch = (id: string, p: Partial<Item>) =>
    updateProject((proj) => ({
      ...proj,
      items: proj.items.map((i) => (i.id === id ? { ...i, ...p } : i)),
    }));

  const addItem = () => {
    const item = createItem('New item', `item_${project.items.length + 1}`);
    updateProject((p) => ({ ...p, items: [...p.items, item] }));
    setKeyEdited(false);
    setEditingId(item.id);
  };

  const removeItem = (id: string) => {
    updateProject((p) => ({
      ...p,
      items: p.items.filter((i) => i.id !== id),
      // Drop references from nodes so nothing dangles.
      nodes: p.nodes.map((n) => ({
        ...n,
        grantsItems: n.grantsItems.filter((x) => x !== id),
        requiresItems: n.requiresItems.filter((x) => x !== id),
      })),
    }));
    setEditingId(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.introBox}>
        <Text style={styles.introText}>
          Items are the pieces the player collects. A node can grant an item and another node can
          require it — even in a different thread — so one character’s progress unlocks another’s.
        </Text>
      </View>
      <FlatList
        data={project.items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{project.items.length} item(s)</Text>
            <Btn label="+ Item" small kind="primary" onPress={addItem} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No items yet"
            hint="Add an item like a keycard or a coupling, then have one node grant it and another require it."
          />
        }
        renderItem={({ item }) => {
          const u = usage(project, item.id);
          return (
            <Pressable style={styles.card} onPress={() => setEditingId(item.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardKey}>items.{item.key}</Text>
                {item.description ? (
                  <Text style={styles.cardSub} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={styles.cardUsage}>
                  granted by {u.grants} · required by {u.requires}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      {editing ? (
        <SheetModal
          visible
          title={editing.name || 'Item'}
          onClose={() => setEditingId(null)}
          footer={
            <>
              <View style={{ flex: 1 }}>
                <Btn label="Delete item" kind="danger" onPress={() => removeItem(editing.id)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="Done" kind="primary" onPress={() => setEditingId(null)} />
              </View>
            </>
          }
        >
          <Field
            label="Name"
            value={editing.name}
            onChangeText={(t) => {
              patch(editing.id, keyEdited ? { name: t } : { name: t, key: slugifyKey(t) });
            }}
            autoFocus
          />
          <Field
            label="Script key (items.___)"
            value={editing.key}
            onChangeText={(t) => {
              setKeyEdited(true);
              patch(editing.id, { key: slugifyKey(t) });
            }}
            mono
          />
          <Field
            label="Description"
            value={editing.description}
            onChangeText={(t) => patch(editing.id, { description: t })}
            multiline
          />
        </SheetModal>
      ) : null}
    </View>
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
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
  cardKey: {
    color: theme.accent,
    fontSize: 12,
    marginTop: 2,
    fontFamily: undefined,
  },
  cardSub: { color: theme.dim, fontSize: 12, marginTop: 4, lineHeight: 17 },
  cardUsage: { color: theme.faint, fontSize: 11, marginTop: 6 },
});
