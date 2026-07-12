import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Entity, Project } from '../types';
import { createEntity, makeId } from '../model';
import { ENTITY_COLORS, theme } from '../theme';
import { Btn, ColorDots, EmptyState, Field, Row, SheetModal } from '../components/ui';

interface Props {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
}

export function EntitiesScreen({ project, updateProject }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = project.entities.find((e) => e.id === editingId);

  const patch = (id: string, p: Partial<Entity>) =>
    updateProject((proj) => ({
      ...proj,
      entities: proj.entities.map((e) => (e.id === id ? { ...e, ...p } : e)),
    }));

  const addEntity = () => {
    const entity = createEntity('New entity');
    updateProject((p) => ({ ...p, entities: [...p.entities, entity] }));
    setEditingId(entity.id);
  };

  const removeEntity = (id: string) => {
    updateProject((p) => ({
      ...p,
      entities: p.entities.filter((e) => e.id !== id),
      // Clear dangling speaker references.
      nodes: p.nodes.map((n) => (n.speakerId === id ? { ...n, speakerId: null } : n)),
    }));
    setEditingId(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Entities</Text>
        <Btn label="+ Entity" small kind="primary" onPress={addEntity} />
      </View>
      <FlatList
        data={project.entities}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <EmptyState
            title="No entities yet"
            hint="Entities are your characters and other named things. Dialogue fragments can pick one as their speaker."
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setEditingId(item.id)}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.cardSub} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              {item.properties.length > 0 ? (
                <Text style={[styles.cardSub, { color: theme.faint }]} numberOfLines={1}>
                  {item.properties.map((p) => `${p.key}: ${p.value}`).join('  ·  ')}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {editing ? (
        <SheetModal
          visible
          title={editing.name || 'Entity'}
          onClose={() => setEditingId(null)}
          footer={
            <>
              <View style={{ flex: 1 }}>
                <Btn label="Delete entity" kind="danger" onPress={() => removeEntity(editing.id)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="Done" kind="primary" onPress={() => setEditingId(null)} />
              </View>
            </>
          }
        >
          <Field label="Name" value={editing.name} onChangeText={(t) => patch(editing.id, { name: t })} />
          <Text style={styles.subLabel}>Color</Text>
          <ColorDots
            colors={ENTITY_COLORS}
            value={editing.color}
            onChange={(c) => patch(editing.id, { color: c })}
          />
          <Field
            label="Description"
            value={editing.description}
            onChangeText={(t) => patch(editing.id, { description: t })}
            multiline
          />
          <Text style={styles.subLabel}>Custom properties</Text>
          {editing.properties.map((prop) => (
            <Row key={prop.id} style={{ marginBottom: 8 }}>
              <View style={{ flex: 2 }}>
                <Field
                  label="Key"
                  value={prop.key}
                  onChangeText={(t) =>
                    patch(editing.id, {
                      properties: editing.properties.map((p) => (p.id === prop.id ? { ...p, key: t } : p)),
                    })
                  }
                />
              </View>
              <View style={{ flex: 3 }}>
                <Field
                  label="Value"
                  value={prop.value}
                  onChangeText={(t) =>
                    patch(editing.id, {
                      properties: editing.properties.map((p) =>
                        p.id === prop.id ? { ...p, value: t } : p
                      ),
                    })
                  }
                />
              </View>
              <Btn
                label="✕"
                small
                onPress={() =>
                  patch(editing.id, { properties: editing.properties.filter((p) => p.id !== prop.id) })
                }
              />
            </Row>
          ))}
          <Btn
            label="+ Add property"
            small
            onPress={() =>
              patch(editing.id, {
                properties: [...editing.properties, { id: makeId(), key: '', value: '' }],
              })
            }
          />
        </SheetModal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.panel,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
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
  swatch: { width: 14, borderRadius: 4 },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: theme.dim, fontSize: 12, marginTop: 3, lineHeight: 17 },
  subLabel: {
    color: theme.dim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
});
