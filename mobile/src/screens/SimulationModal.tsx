import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Project } from '../types';
import { entityById, threadById } from '../model';
import {
  MultiSim,
  SimChoice,
  SimSnapshot,
  ThreadStatus,
  advanceThread,
  choose,
  startSimulation,
  startStory,
  threadSnapshot,
  threadStatus,
} from '../simulation';
import { theme } from '../theme';
import { Btn, Row } from '../components/ui';

interface Props {
  project: Project;
  startNodeId: string | null; // null = play the whole story
  visible: boolean;
  onClose: () => void;
}

export function SimulationModal({ project, startNodeId, visible, onClose }: Props) {
  // Play the whole multi-thread story only when no explicit start node was
  // given and the project actually has threads. "Play here" always tests a
  // single branch in isolation.
  const multiMode = !startNodeId && project.threads.length > 0;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {multiMode ? (
          <MultiPlayer project={project} visible={visible} onClose={onClose} />
        ) : (
          <SinglePlayer project={project} startNodeId={startNodeId} visible={visible} onClose={onClose} />
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared playback: transcript + current card + choices for one snapshot.
// ---------------------------------------------------------------------------

function Playback({
  project,
  snap,
  onChoose,
  scrollRef,
}: {
  project: Project;
  snap: SimSnapshot;
  onChoose: (c: SimChoice) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const node = snap.node;
  const speaker = node ? entityById(project, node.speakerId) : undefined;
  const isCardNode =
    node?.kind === 'dialogue_fragment' || node?.kind === 'media_beat' || node?.kind === 'narration';
  const isHub = node?.kind === 'hub';
  const pastLines = isCardNode ? snap.transcript.slice(0, -1) : snap.transcript;
  const waiting = !snap.ended && !snap.error && snap.choices.length === 0 && !isHub;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef?.current?.scrollToEnd({ animated: true })}
      >
        {pastLines.map((line) => (
          <View key={line.id} style={[styles.pastLine, line.kind === 'media' && styles.pastMedia]}>
            {line.kind === 'media' ? (
              <Text style={styles.mediaTag}>▶ MEDIA BEAT</Text>
            ) : line.kind === 'narration' ? null : line.speaker ? (
              <Text style={styles.pastSpeaker}>{line.speaker}</Text>
            ) : null}
            <Text style={[styles.pastText, line.kind === 'narration' && styles.narrationText]}>{line.text}</Text>
          </View>
        ))}

        {isCardNode && node && node.kind === 'narration' ? (
          <View style={styles.narrationCard}>
            <Text style={styles.narrationEyebrow}>NARRATION</Text>
            <Text style={[styles.currentText, styles.narrationText]}>{node.text || node.displayName}</Text>
          </View>
        ) : isCardNode && node ? (
          <View style={[styles.currentCard, node.kind === 'media_beat' && styles.currentMedia]}>
            {node.kind === 'media_beat' ? (
              <Text style={styles.mediaTag}>▶ MEDIA BEAT — built later in the game</Text>
            ) : speaker ? (
              <Text style={[styles.currentSpeaker, { color: speaker.color }]}>{speaker.name}</Text>
            ) : null}
            <Text style={styles.currentText}>{node.text || node.displayName}</Text>
            {node.kind === 'dialogue_fragment' && node.stageDirections ? (
              <Text style={styles.stage}>{node.stageDirections}</Text>
            ) : null}
          </View>
        ) : null}

        {isHub ? <Text style={styles.hubPrompt}>{node?.displayName || 'Choose:'}</Text> : null}

        {snap.error ? (
          <View style={styles.errorBox}>
            <Text style={{ color: theme.danger, fontSize: 13, lineHeight: 18 }}>Script error: {snap.error}</Text>
          </View>
        ) : null}

        {waiting ? (
          <View style={styles.waitBox}>
            <Text style={styles.waitText}>
              Waiting — the next step here is gated by state you haven’t unlocked yet. Progress another
              thread (or set the required items/variables) and come back.
            </Text>
          </View>
        ) : null}

        {snap.ended && !snap.error ? (
          <View style={styles.endBox}>
            <Text style={{ color: snap.reachedEnding ? theme.ok : theme.dim, fontSize: 16, fontWeight: '700' }}>
              {snap.reachedEnding ? '★ Ending reached' : 'End of flow'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {snap.choices.length > 0 ? (
        <View style={styles.choices}>
          {snap.choices.map((c, i) => (
            <Pressable
              key={c.connectionId ?? `end${i}`}
              style={({ pressed }) => [styles.choiceBtn, pressed && { opacity: 0.7 }]}
              onPress={() => onChoose(c)}
            >
              <Text style={styles.choiceText}>
                {snap.choices.length > 1 ? `${i + 1}.  ` : ''}
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

function StateInspector({ project, vars }: { project: Project; vars: Record<string, string | number | boolean> }) {
  const itemKeys = new Set(project.items.map((i) => `items.${i.key}`));
  const entries = Object.entries(vars);
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.varsTitle}>Shared state</Text>
      {entries.length === 0 ? <Text style={{ color: theme.faint }}>No variables or items.</Text> : null}
      {entries.map(([name, value]) => {
        const isItem = itemKeys.has(name);
        const on = value === true;
        return (
          <View key={name} style={styles.varRow}>
            <Text style={styles.varName}>
              {isItem ? '🎒 ' : ''}
              {name}
            </Text>
            <Text
              style={[
                styles.varValue,
                typeof value === 'boolean' && { color: on ? theme.ok : theme.faint },
              ]}
            >
              {String(value)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Single-flow player
// ---------------------------------------------------------------------------

function SinglePlayer({
  project,
  startNodeId,
  visible,
  onClose,
}: {
  project: Project;
  startNodeId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [showVars, setShowVars] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const restart = () => setSnap(startSimulation(project, startNodeId ?? undefined));

  useEffect(() => {
    if (visible) {
      setSnap(startSimulation(project, startNodeId ?? undefined));
      setShowVars(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, startNodeId]);

  if (!snap) return <View style={{ flex: 1 }} />;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{startNodeId ? 'Play from node' : 'Play'}</Text>
        <Row>
          <Btn label={showVars ? 'Story' : 'State'} small onPress={() => setShowVars((s) => !s)} />
          <Btn label="Restart" small onPress={restart} />
          <Btn label="Close" small kind="primary" onPress={onClose} />
        </Row>
      </View>
      {showVars ? (
        <StateInspector project={project} vars={snap.vars} />
      ) : (
        <Playback project={project} snap={snap} scrollRef={scrollRef} onChoose={(c) => setSnap(choose(project, snap, c))} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Multi-thread player: a switchboard of parallel threads over shared state.
// ---------------------------------------------------------------------------

const STATUS_META: Record<ThreadStatus, { label: string; color: string }> = {
  ready: { label: 'Ready', color: theme.accent },
  blocked: { label: 'Waiting', color: '#d6a03c' },
  complete: { label: 'Done', color: theme.ok },
  error: { label: 'Error', color: theme.danger },
};

function MultiPlayer({ project, visible, onClose }: { project: Project; visible: boolean; onClose: () => void }) {
  const [multi, setMulti] = useState<MultiSim>(() => startStory(project));
  const [openId, setOpenId] = useState<string | null>(null);
  const [showVars, setShowVars] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (visible) {
      setMulti(startStory(project));
      setOpenId(null);
      setShowVars(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const statuses = useMemo(
    () => project.threads.map((t) => ({ thread: t, status: threadStatus(project, multi, t.id) })),
    [project, multi]
  );

  const openThread = openId ? threadById(project, openId) : undefined;
  const openSnap = openId ? threadSnapshot(project, multi, openId) : null;

  return (
    <>
      <View style={styles.header}>
        {openThread ? (
          <Pressable onPress={() => setOpenId(null)} hitSlop={8}>
            <Text style={{ color: theme.accent, fontSize: 15 }}>‹ Threads</Text>
          </Pressable>
        ) : (
          <Text style={styles.headerTitle}>Play</Text>
        )}
        <Row>
          <Btn label={showVars ? 'Threads' : 'State'} small onPress={() => setShowVars((s) => !s)} />
          <Btn
            label="Restart"
            small
            onPress={() => {
              setMulti(startStory(project));
              setOpenId(null);
            }}
          />
          <Btn label="Close" small kind="primary" onPress={onClose} />
        </Row>
      </View>

      {showVars ? (
        <StateInspector project={project} vars={multi.env} />
      ) : openThread && openSnap ? (
        <>
          <View style={[styles.threadStripe, { backgroundColor: openThread.color }]} />
          <Text style={styles.threadHeading}>{openThread.name}</Text>
          <Playback
            project={project}
            snap={openSnap}
            scrollRef={scrollRef}
            onChoose={(c) => setMulti(advanceThread(project, multi, openId!, c))}
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          {multi.finished ? (
            <View style={styles.finishBanner}>
              <Text style={styles.finishTitle}>★ Story complete</Text>
              <Text style={styles.finishSub}>The ending was reached — every required piece came together.</Text>
            </View>
          ) : (
            <Text style={styles.switchboardHint}>
              Work each thread. Some wait on progress from the others; keep switching until the ending opens.
            </Text>
          )}
          {statuses.map(({ thread, status }) => {
            const snap = threadSnapshot(project, multi, thread.id);
            const last = snap?.transcript[snap.transcript.length - 1];
            const character = entityById(project, thread.characterId);
            const meta = STATUS_META[status];
            return (
              <Pressable key={thread.id} style={styles.threadCard} onPress={() => setOpenId(thread.id)}>
                <View style={[styles.threadCardStripe, { backgroundColor: thread.color }]} />
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={styles.threadName} numberOfLines={1}>
                      {thread.name}
                    </Text>
                    <View style={[styles.pill, { borderColor: meta.color }]}>
                      <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </Row>
                  {character ? <Text style={styles.threadChar}>{character.name}</Text> : null}
                  <Text style={styles.threadLast} numberOfLines={2}>
                    {last ? last.text : 'Not started.'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {project.threads.length === 0 ? (
            <Text style={{ color: theme.faint, padding: 20, textAlign: 'center' }}>
              This project has no threads. Add some in the Threads tab, or play a single node with “Play here”.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </>
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

  pastLine: { marginBottom: 14, opacity: 0.55 },
  pastMedia: { opacity: 0.7 },
  pastSpeaker: { color: theme.dim, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  pastText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  mediaTag: { color: '#e07b39', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },

  currentCard: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  currentMedia: { borderColor: '#e07b39', backgroundColor: '#241a12' },
  currentSpeaker: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  currentText: { color: theme.text, fontSize: 17, lineHeight: 25 },
  narrationCard: { marginTop: 8, paddingHorizontal: 12, alignItems: 'center' },
  narrationEyebrow: {
    color: theme.faint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  narrationText: { fontStyle: 'italic', color: theme.dim, textAlign: 'center', lineHeight: 24 },
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
  waitBox: {
    backgroundColor: '#241f12',
    borderWidth: 1,
    borderColor: '#d6a03c',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  waitText: { color: '#e6cf96', fontSize: 13, lineHeight: 18 },
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

  // Multi-thread switchboard
  switchboardHint: { color: theme.dim, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  threadCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  threadCardStripe: { width: 6, borderRadius: 3 },
  threadName: { color: theme.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  threadChar: { color: theme.dim, fontSize: 12, marginTop: 2 },
  threadLast: { color: theme.faint, fontSize: 13, marginTop: 6, lineHeight: 18 },
  pill: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700' },

  threadStripe: { height: 3, marginHorizontal: 0 },
  threadHeading: { color: theme.text, fontSize: 14, fontWeight: '700', paddingHorizontal: 16, paddingTop: 10 },

  finishBanner: {
    backgroundColor: '#12271b',
    borderWidth: 1,
    borderColor: theme.ok,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  finishTitle: { color: theme.ok, fontSize: 18, fontWeight: '800' },
  finishSub: { color: theme.dim, fontSize: 13, marginTop: 4, lineHeight: 18 },
});
