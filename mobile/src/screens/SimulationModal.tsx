import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Project } from '../types';
import { entityById } from '../model';
import { SimSnapshot, choose, startSimulation } from '../simulation';
import { theme } from '../theme';
import { Btn, Row } from '../components/ui';

interface Props {
  project: Project;
  startNodeId: string | null; // null = play from the beginning
  visible: boolean;
  onClose: () => void;
}

export function SimulationModal({ project, startNodeId, visible, onClose }: Props) {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [showVars, setShowVars] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setSnap(startSimulation(project, startNodeId ?? undefined));
      setShowVars(false);
    }
    // Intentionally only reruns when the player is opened; edits made while
    // the player is closed are picked up on the next open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, startNodeId]);

  if (!snap) {
    return <Modal visible={visible} animationType="slide" onRequestClose={onClose} />;
  }

  const speaker = snap.node ? entityById(project, snap.node.speakerId) : undefined;
  const isHub = snap.node?.kind === 'hub';
  // The current dialogue fragment is already the last transcript entry;
  // show it in the highlighted card instead of the history list.
  const pastLines =
    snap.node?.kind === 'dialogue_fragment' ? snap.transcript.slice(0, -1) : snap.transcript;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Presentation</Text>
          <Row>
            <Btn label={showVars ? 'Story' : 'Variables'} small onPress={() => setShowVars((s) => !s)} />
            <Btn
              label="Restart"
              small
              onPress={() => setSnap(startSimulation(project, startNodeId ?? undefined))}
            />
            <Btn label="Close" small kind="primary" onPress={onClose} />
          </Row>
        </View>

        {showVars ? (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.varsTitle}>Current variable state</Text>
            {Object.entries(snap.vars).map(([name, value]) => (
              <View key={name} style={styles.varRow}>
                <Text style={styles.varName}>{name}</Text>
                <Text style={[styles.varValue, typeof value === 'boolean' && { color: value ? theme.ok : theme.danger }]}>
                  {String(value)}
                </Text>
              </View>
            ))}
            {Object.keys(snap.vars).length === 0 ? (
              <Text style={{ color: theme.faint }}>This project has no variables.</Text>
            ) : null}
          </ScrollView>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {pastLines.map((line) => (
                <View key={line.id} style={styles.pastLine}>
                  {line.speaker ? <Text style={styles.pastSpeaker}>{line.speaker}</Text> : null}
                  <Text style={styles.pastText}>{line.text}</Text>
                </View>
              ))}

              {snap.node && !isHub ? (
                <View style={styles.currentCard}>
                  {speaker ? (
                    <Text style={[styles.currentSpeaker, { color: speaker.color }]}>{speaker.name}</Text>
                  ) : null}
                  <Text style={styles.currentText}>{snap.node.text || snap.node.displayName}</Text>
                  {snap.node.stageDirections ? (
                    <Text style={styles.stage}>{snap.node.stageDirections}</Text>
                  ) : null}
                </View>
              ) : null}

              {isHub ? (
                <Text style={styles.hubPrompt}>{snap.node?.displayName || 'Choose:'}</Text>
              ) : null}

              {snap.error ? (
                <View style={styles.errorBox}>
                  <Text style={{ color: theme.danger, fontSize: 13, lineHeight: 18 }}>
                    Script error: {snap.error}
                  </Text>
                </View>
              ) : null}

              {snap.ended && !snap.error ? (
                <View style={styles.endBox}>
                  <Text style={{ color: theme.dim, fontSize: 15, fontWeight: '600' }}>End of flow</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.choices}>
              {snap.choices.map((c, i) => (
                <Pressable
                  key={c.connectionId ?? `end${i}`}
                  style={({ pressed }) => [styles.choiceBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setSnap(choose(project, snap, c))}
                >
                  <Text style={styles.choiceText}>
                    {snap.choices.length > 1 ? `${i + 1}.  ` : ''}
                    {c.label}
                  </Text>
                </Pressable>
              ))}
              {snap.ended ? (
                <Pressable
                  style={({ pressed }) => [styles.choiceBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setSnap(startSimulation(project, startNodeId ?? undefined))}
                >
                  <Text style={styles.choiceText}>↺  Play again</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: '700' },
  varsTitle: { color: theme.dim, fontSize: 13, fontWeight: '700', marginBottom: 12 },
  varRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  varName: { color: theme.text, fontSize: 14 },
  varValue: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  pastLine: { marginBottom: 14, opacity: 0.55 },
  pastSpeaker: { color: theme.dim, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  pastText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  currentCard: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  currentSpeaker: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  currentText: { color: theme.text, fontSize: 17, lineHeight: 25 },
  stage: { color: theme.dim, fontSize: 13, fontStyle: 'italic', marginTop: 10, lineHeight: 18 },
  hubPrompt: { color: theme.dim, fontSize: 15, fontWeight: '600', marginTop: 8 },
  errorBox: {
    backgroundColor: '#2a1618',
    borderWidth: 1,
    borderColor: theme.danger,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  endBox: { alignItems: 'center', padding: 24 },
  choices: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: theme.border },
  choiceBtn: {
    backgroundColor: theme.panelRaised,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  choiceText: { color: theme.text, fontSize: 15, fontWeight: '500' },
});
