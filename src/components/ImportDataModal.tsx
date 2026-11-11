import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  parseImportPayload,
  applyImportPayload,
  ImportPreview,
  ImportResult,
} from '../services/dataExportImport';
import { colors } from '../constants/theme';

interface ImportDataModalProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
}

export const ImportDataModal: React.FC<ImportDataModalProps> = ({
  visible,
  onClose,
  onImportComplete,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<any>(null);

  const handleTextChange = (text: string) => {
    setJsonText(text);
    setErrorMsg('');
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    const result = parseImportPayload(text);
    setPreview(result);
    if (!result.valid) {
      setErrorMsg(result.errorMessage || 'Invalid JSON format');
    }
  };

  const handleFilePicked = (event: any) => {
    if (Platform.OS !== 'web') return;
    const files = event.target?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        handleTextChange(content);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read chosen file.');
    };
    reader.readAsText(file);
  };

  const triggerWebFilePicker = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleApply = async () => {
    if (!preview || !preview.valid) {
      setErrorMsg('Please paste or select valid JSON before importing.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const result = await applyImportPayload(preview, mode);
      setJsonText('');
      setPreview(null);
      onImportComplete(result);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Import failed. Please check the JSON format.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setJsonText('');
    setPreview(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <FontAwesome5 name="file-import" size={16} color="#0284c7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>DATA MANAGEMENT</Text>
              <Text style={styles.title}>Import sleep data</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <FontAwesome5 name="times" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Import sleep events, logs, and settings from a JSON file or paste the JSON text directly.
            </Text>

            {/* Web File Chooser */}
            {Platform.OS === 'web' ? (
              <View style={styles.fileChooserWrap}>
                <TouchableOpacity
                  style={styles.chooseFileBtn}
                  onPress={triggerWebFilePicker}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="folder-open" size={14} color="#0284c7" />
                  <Text style={styles.chooseFileText}>Select backup file (.json)</Text>
                </TouchableOpacity>
                {/* Hidden input for web */}
                {React.createElement('input', {
                  type: 'file',
                  accept: '.json,application/json',
                  ref: fileInputRef,
                  style: { display: 'none' },
                  onChange: handleFilePicked,
                })}
              </View>
            ) : null}

            {/* Mode selection pills */}
            <Text style={styles.label}>Import mode</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modePill, mode === 'replace' && styles.modePillActive]}
                onPress={() => setMode('replace')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modePillText, mode === 'replace' && styles.modePillTextActive]}>
                  Replace existing
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modePill, mode === 'merge' && styles.modePillActive]}
                onPress={() => setMode('merge')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modePillText, mode === 'merge' && styles.modePillTextActive]}>
                  Merge with existing
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modeHint}>
              {mode === 'replace'
                ? 'Replaces all current sleep records with the imported data.'
                : 'Merges new events into your existing history without duplicating.'}
            </Text>

            {/* JSON Input field */}
            <Text style={styles.label}>JSON payload</Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={6}
              value={jsonText}
              onChangeText={handleTextChange}
              placeholder="Paste JSON content here or select a file above..."
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Error banner */}
            {errorMsg ? (
              <View style={styles.errorBanner}>
                <FontAwesome5 name="exclamation-circle" size={13} color="#ef4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Preview card when parsed */}
            {preview && preview.valid ? (
              <View style={styles.previewCard}>
                <View style={styles.previewTitleRow}>
                  <FontAwesome5 name="check-circle" size={14} color="#10b981" />
                  <Text style={styles.previewTitle}>Detected backup contents</Text>
                </View>
                <View style={styles.statGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{preview.sleepEventsCount}</Text>
                    <Text style={styles.statLabel}>Sleep events</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{preview.dailyCheckInsCount}</Text>
                    <Text style={styles.statLabel}>Check-ins</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{preview.hasProfile ? 'Yes' : 'No'}</Text>
                    <Text style={styles.statLabel}>Profile</Text>
                  </View>
                </View>
                {preview.firstEventDate && preview.lastEventDate ? (
                  <Text style={styles.dateRangeText}>
                    Date range: {preview.firstEventDate} to {preview.lastEventDate}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.importBtn,
                (!preview || !preview.valid || loading) && styles.importBtnDisabled,
              ]}
              onPress={handleApply}
              disabled={!preview || !preview.valid || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <FontAwesome5 name="check" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.importBtnText}>Confirm import</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(7, 17, 38, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#cfe0ee',
    shadowColor: '#071126',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  eyebrow: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  title: {
    color: '#142c43',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    maxHeight: 400,
    marginBottom: 14,
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  fileChooserWrap: {
    marginBottom: 14,
  },
  chooseFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  chooseFileText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  modePill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modePillActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#7dd3fc',
  },
  modePillText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  modePillTextActive: {
    color: '#0284c7',
    fontWeight: '600',
  },
  modeHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 14,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    color: colors.text,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    flex: 1,
  },
  previewCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  previewTitle: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '600',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  statValue: {
    color: '#15803d',
    fontSize: 15,
    fontWeight: '600',
  },
  statLabel: {
    color: '#4b5563',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  dateRangeText: {
    color: '#166534',
    fontSize: 11,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  importBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  importBtnDisabled: {
    opacity: 0.45,
  },
  importBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

