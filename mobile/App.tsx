import React, { useState } from 'react';
import { ActivityIndicator, Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './src/store';
import { theme } from './src/theme';
import { ProjectListScreen } from './src/screens/ProjectListScreen';
import { ProjectScreen } from './src/screens/ProjectScreen';

function Root() {
  const { loaded, projects } = useStore();
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const openProject = projects.find((p) => p.id === openProjectId);

  if (!loaded) {
    return (
      <View style={[styles.app, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.app}>
      {openProject ? (
        <ProjectScreen project={openProject} onBack={() => setOpenProjectId(null)} />
      ) : (
        <ProjectListScreen onOpen={setOpenProjectId} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Root />
    </StoreProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 52,
  },
});
