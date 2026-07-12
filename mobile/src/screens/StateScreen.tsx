import React, { useState } from 'react';
import { View } from 'react-native';
import type { Project } from '../types';
import { theme } from '../theme';
import { Segmented } from '../components/ui';
import { VariablesScreen } from './VariablesScreen';
import { ItemsScreen } from './ItemsScreen';

interface Props {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
}

/** Groups the two kinds of shared state — variables and items — under one tab. */
export function StateScreen({ project, updateProject }: Props) {
  const [view, setView] = useState<'variables' | 'items'>('variables');
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, backgroundColor: theme.panel }}>
        <Segmented<'variables' | 'items'>
          options={[
            { value: 'variables', label: 'Variables' },
            { value: 'items', label: 'Items' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
      {view === 'variables' ? (
        <VariablesScreen project={project} updateProject={updateProject} />
      ) : (
        <ItemsScreen project={project} updateProject={updateProject} />
      )}
    </View>
  );
}
