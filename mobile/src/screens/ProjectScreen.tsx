import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Project } from '../types';
import { useStore } from '../store';
import { theme } from '../theme';
import { FlowScreen } from './FlowScreen';
import { ThreadsScreen } from './ThreadsScreen';
import { EntitiesScreen } from './EntitiesScreen';
import { StateScreen } from './StateScreen';
import { LocationsScreen } from './LocationsScreen';
import { SimulationModal } from './SimulationModal';

type Tab = 'flow' | 'threads' | 'entities' | 'state' | 'locations';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'flow', label: 'Flow', icon: '⧉' },
  { key: 'threads', label: 'Threads', icon: '⑃' },
  { key: 'entities', label: 'Cast', icon: '☻' },
  { key: 'state', label: 'State', icon: '𝑥' },
  { key: 'locations', label: 'Places', icon: '⌖' },
];

interface Props {
  project: Project;
  onBack: () => void;
}

export function ProjectScreen({ project, onBack }: Props) {
  const { updateProject } = useStore();
  const [tab, setTab] = useState<Tab>('flow');
  const [player, setPlayer] = useState<{ visible: boolean; startNodeId: string | null }>({
    visible: false,
    startNodeId: null,
  });

  const update = useCallback(
    (updater: (p: Project) => Project) => updateProject(project.id, updater),
    [updateProject, project.id]
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}>
          <Text style={{ color: theme.accent, fontSize: 15 }}>‹ Projects</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {project.name}
        </Text>
        <Pressable
          onPress={() => setPlayer({ visible: true, startNodeId: null })}
          style={styles.playBtn}
          hitSlop={8}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>▶ Play</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'flow' ? (
          <FlowScreen
            project={project}
            updateProject={update}
            onPlayFrom={(nodeId) => setPlayer({ visible: true, startNodeId: nodeId })}
          />
        ) : null}
        {tab === 'threads' ? <ThreadsScreen project={project} updateProject={update} /> : null}
        {tab === 'entities' ? <EntitiesScreen project={project} updateProject={update} /> : null}
        {tab === 'state' ? <StateScreen project={project} updateProject={update} /> : null}
        {tab === 'locations' ? <LocationsScreen project={project} updateProject={update} /> : null}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabIcon, tab === t.key && { color: theme.accent }]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && { color: theme.accent, fontWeight: '700' }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SimulationModal
        project={project}
        startNodeId={player.startNodeId}
        visible={player.visible}
        onClose={() => setPlayer((p) => ({ ...p, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.panel,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: { color: theme.text, fontSize: 16, fontWeight: '700', flex: 1 },
  playBtn: {
    backgroundColor: theme.ok,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.panel,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingBottom: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  tabIcon: { color: theme.dim, fontSize: 16 },
  tabLabel: { color: theme.dim, fontSize: 11 },
});
