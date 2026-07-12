import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LocationItem, Project } from '../types';
import { createLocation } from '../model';
import { theme } from '../theme';
import { Btn, EmptyState, Field, SheetModal } from '../components/ui';

interface Props {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
}

export function LocationsScreen({ project, updateProject }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = project.locations.find((l) => l.id === editingId);

  const patch = (id: string, p: Partial<LocationItem>) =>
    updateProject((proj) => ({
      ...proj,
      locations: proj.locations.map((l) => (l.id === id ? { ...l, ...p } : l)),
    }));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Locations</Text>
        <Btn
          label="+ Location"
          small
          kind="primary"
          onPress={() => {
            const loc = createLocation('New location');
            updateProject((p) => ({ ...p, locations: [...p.locations, loc] }));
            setEditingId(loc.id);
          }}
        />
      </View>
      <FlatList
        data={project.locations}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          <EmptyState
            title="No locations yet"
            hint="Keep track of the places in your story world and what happens there."
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setEditingId(item.id)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.cardSub} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
      {editing ? (
        <SheetModal
          visible
          title={editing.name || 'Location'}
          onClose={() => setEditingId(null)}
          footer={
            <>
              <View style={{ flex: 1 }}>
                <Btn
                  label="Delete location"
                  kind="danger"
                  onPress={() => {
                    updateProject((p) => ({
                      ...p,
                      locations: p.locations.filter((l) => l.id !== editing.id),
                    }));
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
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: theme.dim, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
