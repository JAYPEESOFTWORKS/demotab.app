import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../theme';

export function Btn({
  label,
  onPress,
  kind = 'default',
  small = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  kind?: 'default' | 'primary' | 'danger' | 'ghost';
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        kind === 'primary' && { backgroundColor: theme.accent, borderColor: theme.accent },
        kind === 'danger' && { backgroundColor: 'transparent', borderColor: theme.danger },
        kind === 'ghost' && { backgroundColor: 'transparent', borderColor: 'transparent' },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          small && { fontSize: 13 },
          kind === 'primary' && { color: '#fff', fontWeight: '600' },
          kind === 'danger' && { color: theme.danger },
          kind === 'ghost' && { color: theme.accent },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  autoFocus = false,
  mono = false,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  mono?: boolean;
  error?: string | null;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        multiline={multiline}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={!mono}
        style={[
          styles.input,
          multiline && { minHeight: 80, textAlignVertical: 'top' },
          mono && { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
          !!error && { borderColor: theme.danger },
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentActive]}
        >
          <Text
            style={[
              styles.segmentText,
              o.value === value && { color: '#fff', fontWeight: '600' },
            ]}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SheetModal({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {title}
            </Text>
            <Btn label="Close" kind="ghost" small onPress={onClose} />
          </View>
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 40 }}>
      <Text style={{ color: theme.dim, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>{title}</Text>
      <Text style={{ color: theme.faint, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>{hint}</Text>
    </View>
  );
}

export function ColorDots({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string | null;
  onChange: (c: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
      {colors.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: c,
            borderWidth: value === c ? 3 : 1,
            borderColor: value === c ? '#fff' : theme.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: theme.panelRaised,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { color: theme.text, fontSize: 14 },
  fieldLabel: {
    color: theme.dim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldError: { color: theme.danger, fontSize: 12, marginTop: 4 },
  input: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    fontSize: 15,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.accent },
  segmentText: { color: theme.dim, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sheetTitle: { color: theme.text, fontSize: 17, fontWeight: '700', flex: 1, marginRight: 12 },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
