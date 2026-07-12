import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Project, Variable, VariableSet, VariableType } from '../types';
import { createVariable, createVariableSet, defaultValueFor } from '../model';
import { theme } from '../theme';
import { Btn, EmptyState, Field, Row, Segmented, SheetModal } from '../components/ui';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface Props {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
}

export function VariablesScreen({ project, updateProject }: Props) {
  const [editing, setEditing] = useState<{ setId: string; varId: string } | null>(null);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [newSetName, setNewSetName] = useState('');

  const patchSet = (setId: string, p: Partial<VariableSet>) =>
    updateProject((proj) => ({
      ...proj,
      variableSets: proj.variableSets.map((s) => (s.id === setId ? { ...s, ...p } : s)),
    }));

  const patchVar = (setId: string, varId: string, p: Partial<Variable>) =>
    updateProject((proj) => ({
      ...proj,
      variableSets: proj.variableSets.map((s) =>
        s.id === setId
          ? { ...s, variables: s.variables.map((v) => (v.id === varId ? { ...v, ...p } : v)) }
          : s
      ),
    }));

  const addSet = () => {
    const name = newSetName.trim();
    if (!IDENT.test(name)) {
      Alert.alert('Invalid name', 'Set names must be identifiers, e.g. "inventory" or "quest_state".');
      return;
    }
    if (project.variableSets.some((s) => s.name === name)) {
      Alert.alert('Duplicate name', `A set called "${name}" already exists.`);
      return;
    }
    updateProject((p) => ({ ...p, variableSets: [...p.variableSets, createVariableSet(name)] }));
    setNewSetName('');
    setNewSetOpen(false);
  };

  const addVariable = (set: VariableSet) => {
    let n = set.variables.length + 1;
    let name = `variable${n}`;
    while (set.variables.some((v) => v.name === name)) name = `variable${++n}`;
    const variable = createVariable(name, 'boolean');
    patchSet(set.id, { variables: [...set.variables, variable] });
    setEditing({ setId: set.id, varId: variable.id });
  };

  const removeSet = (set: VariableSet) => {
    Alert.alert('Delete set', `Delete "${set.name}" and its ${set.variables.length} variable(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          updateProject((p) => ({
            ...p,
            variableSets: p.variableSets.filter((s) => s.id !== set.id),
          })),
      },
    ]);
  };

  const editingSet = project.variableSets.find((s) => s.id === editing?.setId);
  const editingVar = editingSet?.variables.find((v) => v.id === editing?.varId);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Global variables</Text>
        <Btn label="+ Set" small kind="primary" onPress={() => setNewSetOpen(true)} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {project.variableSets.length === 0 ? (
          <EmptyState
            title="No variable sets yet"
            hint={'Variables drive conditions and instructions.\nScripts reference them as setName.variableName, e.g. inventory.gold >= 10.'}
          />
        ) : null}
        {project.variableSets.map((set) => (
          <View key={set.id} style={styles.setCard}>
            <Row style={{ marginBottom: 8 }}>
              <Text style={styles.setName}>{set.name}</Text>
              <View style={{ flex: 1 }} />
              <Btn label="+ Variable" small onPress={() => addVariable(set)} />
              <Btn label="Delete" small kind="danger" onPress={() => removeSet(set)} />
            </Row>
            {set.variables.map((v) => (
              <Row key={v.id} style={styles.varRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.varName}>
                    {set.name}.{v.name}
                  </Text>
                  {v.description ? (
                    <Text style={styles.varDesc} numberOfLines={1}>
                      {v.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.varType}>{v.type}</Text>
                <Text style={styles.varDefault}>{String(v.defaultValue)}</Text>
                <Btn label="Edit" small onPress={() => setEditing({ setId: set.id, varId: v.id })} />
              </Row>
            ))}
            {set.variables.length === 0 ? (
              <Text style={{ color: theme.faint, fontSize: 12 }}>No variables in this set.</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <SheetModal
        visible={newSetOpen}
        title="New variable set"
        onClose={() => setNewSetOpen(false)}
        footer={
          <View style={{ flex: 1 }}>
            <Btn label="Create set" kind="primary" onPress={addSet} />
          </View>
        }
      >
        <Field
          label="Set name (namespace)"
          value={newSetName}
          onChangeText={setNewSetName}
          placeholder="inventory"
          autoFocus
          mono
        />
      </SheetModal>

      {editingSet && editingVar ? (
        <SheetModal
          visible
          title={`${editingSet.name}.${editingVar.name}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <View style={{ flex: 1 }}>
                <Btn
                  label="Delete variable"
                  kind="danger"
                  onPress={() => {
                    patchSet(editingSet.id, {
                      variables: editingSet.variables.filter((v) => v.id !== editingVar.id),
                    });
                    setEditing(null);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="Done" kind="primary" onPress={() => setEditing(null)} />
              </View>
            </>
          }
        >
          <Field
            label="Name"
            value={editingVar.name}
            onChangeText={(t) => patchVar(editingSet.id, editingVar.id, { name: t })}
            mono
            error={IDENT.test(editingVar.name) ? null : 'Must be an identifier (letters, digits, _)'}
          />
          <Text style={styles.subLabel}>Type</Text>
          <Segmented<VariableType>
            options={[
              { value: 'boolean', label: 'Boolean' },
              { value: 'integer', label: 'Integer' },
              { value: 'string', label: 'String' },
            ]}
            value={editingVar.type}
            onChange={(type) =>
              patchVar(editingSet.id, editingVar.id, { type, defaultValue: defaultValueFor(type) })
            }
          />
          <Text style={styles.subLabel}>Default value</Text>
          {editingVar.type === 'boolean' ? (
            <Segmented<'true' | 'false'>
              options={[
                { value: 'false', label: 'false' },
                { value: 'true', label: 'true' },
              ]}
              value={editingVar.defaultValue === true ? 'true' : 'false'}
              onChange={(v) => patchVar(editingSet.id, editingVar.id, { defaultValue: v === 'true' })}
            />
          ) : (
            <Field
              label=""
              value={String(editingVar.defaultValue)}
              onChangeText={(t) =>
                patchVar(editingSet.id, editingVar.id, {
                  defaultValue:
                    editingVar.type === 'integer' ? (Number.parseInt(t, 10) || 0) : t,
                })
              }
              mono
            />
          )}
          <Field
            label="Description"
            value={editingVar.description}
            onChangeText={(t) => patchVar(editingSet.id, editingVar.id, { description: t })}
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
  setCard: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  setName: { color: theme.text, fontSize: 15, fontWeight: '700' },
  varRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  varName: { color: theme.text, fontSize: 13, fontFamily: undefined },
  varDesc: { color: theme.faint, fontSize: 11, marginTop: 2 },
  varType: { color: theme.dim, fontSize: 11, width: 52 },
  varDefault: { color: theme.accent, fontSize: 12, maxWidth: 70 },
  subLabel: {
    color: theme.dim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
});
