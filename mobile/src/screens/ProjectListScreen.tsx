import React, { useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { Project } from '../types';
import { parseProjectImport, projectToExport } from '../model';
import { useStore } from '../store';
import { theme } from '../theme';
import { Btn, EmptyState, Field, Row, SheetModal } from '../components/ui';

interface Props {
  onOpen: (projectId: string) => void;
}

export function ProjectListScreen({ onOpen }: Props) {
  const { projects, addProject, addImportedProject, removeProject, cloneProject, updateProject } =
    useStore();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const create = () => {
    const project = addProject(newName);
    setNewOpen(false);
    setNewName('');
    onOpen(project.id);
  };

  const runImport = () => {
    try {
      const project = parseProjectImport(importText);
      addImportedProject(project);
      setImportOpen(false);
      setImportText('');
      setImportError(null);
      onOpen(project.id);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    }
  };

  const exportProject = (project: Project) => {
    void Share.share({
      title: `${project.name}.storydraft.json`,
      message: JSON.stringify(projectToExport(project), null, 2),
    });
  };

  const confirmDelete = (project: Project) => {
    Alert.alert('Delete project', `Delete "${project.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeProject(project.id) },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>StoryDraft</Text>
          <Text style={styles.appSub}>Narrative design on the go</Text>
        </View>
        <Btn label="Import" small onPress={() => setImportOpen(true)} />
        <Btn label="+ New" small kind="primary" onPress={() => setNewOpen(true)} />
      </View>

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={
          <EmptyState
            title="No projects"
            hint="Create a project to start designing branching stories, or import one from a JSON export."
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpen(item.id)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>
              {item.nodes.length} nodes · {item.entities.length} entities ·{' '}
              {item.variableSets.reduce((n, s) => n + s.variables.length, 0)} variables
            </Text>
            <Text style={[styles.cardSub, { color: theme.faint }]}>
              Updated {new Date(item.updatedAt).toLocaleString()}
            </Text>
            <Row style={{ marginTop: 10 }}>
              <Btn label="Export" small onPress={() => exportProject(item)} />
              <Btn label="Duplicate" small onPress={() => cloneProject(item.id)} />
              <Btn
                label="Rename"
                small
                onPress={() => {
                  setRenamingId(item.id);
                  setRenameText(item.name);
                }}
              />
              <Btn label="Delete" small kind="danger" onPress={() => confirmDelete(item)} />
            </Row>
          </Pressable>
        )}
      />

      <SheetModal
        visible={newOpen}
        title="New project"
        onClose={() => setNewOpen(false)}
        footer={
          <View style={{ flex: 1 }}>
            <Btn label="Create project" kind="primary" onPress={create} />
          </View>
        }
      >
        <Field
          label="Project name"
          value={newName}
          onChangeText={setNewName}
          placeholder="My interactive story"
          autoFocus
        />
      </SheetModal>

      <SheetModal
        visible={importOpen}
        title="Import project"
        onClose={() => setImportOpen(false)}
        footer={
          <View style={{ flex: 1 }}>
            <Btn label="Import" kind="primary" onPress={runImport} disabled={!importText.trim()} />
          </View>
        }
      >
        <Text style={{ color: theme.dim, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
          Paste the JSON produced by Export on another device. The project is added as a copy with a
          new id.
        </Text>
        <Field
          label="Project JSON"
          value={importText}
          onChangeText={(t) => {
            setImportText(t);
            setImportError(null);
          }}
          placeholder='{"format":"storydraft.project.v1", …}'
          multiline
          mono
          error={importError}
        />
      </SheetModal>

      <SheetModal
        visible={renamingId != null}
        title="Rename project"
        onClose={() => setRenamingId(null)}
        footer={
          <View style={{ flex: 1 }}>
            <Btn
              label="Save"
              kind="primary"
              onPress={() => {
                if (renamingId) {
                  updateProject(renamingId, (p) => ({ ...p, name: renameText.trim() || p.name }));
                }
                setRenamingId(null);
              }}
            />
          </View>
        }
      >
        <Field label="Project name" value={renameText} onChangeText={setRenameText} autoFocus />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.panel,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  appName: { color: theme.text, fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  appSub: { color: theme.faint, fontSize: 11, marginTop: 1 },
  card: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  cardSub: { color: theme.dim, fontSize: 12, marginTop: 4 },
});
