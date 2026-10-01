import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  eyebrow?: string;
  destructive?: boolean;
  artwork?: 'offer' | 'unplug' | 'computer' | 'ble-disconnect' | 'ble-reconnect';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  eyebrow,
  destructive = false,
  artwork = 'offer',
  onConfirm,
  onCancel,
}) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.card}>
        <View style={styles.heroRow}>
          <View style={[styles.artStage, destructive && styles.artStageDestructive]}>
            <Image
              source={
                artwork === 'unplug'
                  ? require('../../assets/hagosaur-unplugging-pillow.png')
                  : artwork === 'computer'
                    ? require('../../assets/hagosaur-ai-repair.png')
                    : artwork === 'ble-disconnect'
                      ? require('../../assets/hagosaur-ble-disconnect.png')
                      : artwork === 'ble-reconnect'
                        ? require('../../assets/hagosaur-ble-reconnect.png')
                  : require('../../assets/hagosaur-confirm-offer.png')
              }
              style={styles.artwork}
              resizeMode="contain"
              accessible
              accessibilityLabel={
                artwork === 'unplug'
                  ? 'Hagosaur unplugging the smart pillow'
                  : artwork === 'computer'
                    ? 'Hagosaur holding a computer with a repair symbol'
                    : artwork === 'ble-disconnect'
                      ? 'Hagosaur carefully disconnecting the Bluetooth link to the smart pillow'
                      : artwork === 'ble-reconnect'
                        ? 'Hagosaur reconnecting the Bluetooth link to the smart pillow'
                  : 'Hagosaur offering a choice'
              }
            />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.eyebrow, destructive && styles.eyebrowDestructive]}>
              {eyebrow ?? (artwork === 'unplug'
                ? 'CONNECTION CHECK'
                : artwork === 'computer'
                  ? 'MODEL REPAIR'
                  : artwork === 'ble-disconnect'
                    ? 'BLE DISCONNECT'
                    : artwork === 'ble-reconnect'
                      ? 'BLE RECONNECT'
                : destructive
                  ? 'SAFETY CHECK'
                  : 'HAGOSAUR CHECK-IN')}
            </Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            activeOpacity={0.82}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.button, destructive ? styles.destructiveButton : styles.confirmButton]}
            onPress={onConfirm}
            activeOpacity={0.86}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(7, 17, 38, 0.72)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: '#cfe0ee',
    shadowColor: '#071126',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  artStage: {
    width: 102,
    height: 108,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: '#e8f6fd',
    borderWidth: 1,
    borderColor: '#bae6fd',
    overflow: 'hidden',
  },
  artStageDestructive: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  artwork: { width: 112, height: 112, marginTop: 8 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: '#0284c7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  eyebrowDestructive: { color: '#e11d48' },
  title: {
    color: '#142c43',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 6,
  },
  message: {
    color: '#52677b',
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e4edf4',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfd4e3',
  },
  confirmButton: {
    backgroundColor: '#0ea5e9',
  },
  destructiveButton: {
    backgroundColor: '#ef4444',
  },
  cancelText: {
    color: '#344b60',
    fontWeight: '800',
    fontSize: 14,
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
