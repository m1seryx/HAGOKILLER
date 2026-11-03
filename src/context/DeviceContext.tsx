import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BLEDevice } from '../types';
import { bleService } from '../services/bleService';
import type { MicTestPreview } from '../services/esp32Protocol';

interface DeviceContextValue {
  connected: boolean;
  pairedDevice: BLEDevice | null;
  scanning: boolean;
  nearbyDevices: BLEDevice[];
  snoreDetectionEnabled: boolean;
  micTestActive: boolean;
  micTestPreview: MicTestPreview | null;
  scan: () => Promise<void>;
  pair: (device: BLEDevice, pin: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  unpair: () => Promise<void>;
  startSnoreDetection: () => Promise<void>;
  stopSnoreDetection: () => Promise<void>;
  startMicTest: () => Promise<void>;
  stopMicTest: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

function readDetectionEnabled(): boolean {
  const svc = bleService as { isSnoreDetectionEnabled?: () => boolean };
  return typeof svc.isSnoreDetectionEnabled === 'function' ? svc.isSnoreDetectionEnabled() : true;
}

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(bleService.getIsConnected());
  const [pairedDevice, setPairedDevice] = useState<BLEDevice | null>(bleService.getPairedDevice());
  const [scanning, setScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<BLEDevice[]>([]);
  const [snoreDetectionEnabled, setSnoreDetectionEnabled] = useState(readDetectionEnabled);
  const [micTestActive, setMicTestActive] = useState(false);
  const [micTestPreview, setMicTestPreview] = useState<MicTestPreview | null>(null);

  const refresh = () => {
    setConnected(bleService.getIsConnected());
    setPairedDevice(bleService.getPairedDevice());
    setSnoreDetectionEnabled(readDetectionEnabled());
  };

  useEffect(() => {
    bleService.restoreSession().then(refresh).catch(() => refresh());
    return bleService.subscribe(refresh);
  }, []);

  useEffect(() => {
    const svc = bleService as {
      subscribeMicTest?: (listener: (preview: MicTestPreview) => void) => () => void;
    };
    if (typeof svc.subscribeMicTest !== 'function') return undefined;
    return svc.subscribeMicTest((preview) => {
      setMicTestPreview(preview);
    });
  }, []);

  // Only clear local mic-test UI on disconnect. Overnight Start still stops it explicitly.
  useEffect(() => {
    if (!connected) {
      setMicTestActive(false);
      setMicTestPreview(null);
    }
  }, [connected]);

  useEffect(() => {
    if (snoreDetectionEnabled) {
      setMicTestActive(false);
      setMicTestPreview(null);
    }
  }, [snoreDetectionEnabled]);

  const value = useMemo<DeviceContextValue>(
    () => ({
      connected,
      pairedDevice,
      scanning,
      nearbyDevices,
      snoreDetectionEnabled,
      micTestActive,
      micTestPreview,
      scan: async () => {
        setScanning(true);
        try {
          const found = await bleService.scanForDevices();
          setNearbyDevices(found);
        } finally {
          setScanning(false);
        }
      },
      pair: async (device, pin) => {
        await bleService.pair(device, pin);
        refresh();
      },
      connect: async () => {
        await bleService.connect();
        refresh();
      },
      disconnect: async () => {
        if (micTestActive) {
          try {
            await bleService.sendDeviceCommand('mic_test_stop');
          } catch {
            // ignore
          }
        }
        setMicTestActive(false);
        setMicTestPreview(null);
        await bleService.disconnect();
        refresh();
      },
      unpair: async () => {
        if (micTestActive) {
          try {
            await bleService.sendDeviceCommand('mic_test_stop');
          } catch {
            // ignore
          }
        }
        setMicTestActive(false);
        setMicTestPreview(null);
        await bleService.unpair();
        setNearbyDevices([]);
        refresh();
      },
      startSnoreDetection: async () => {
        if (micTestActive) {
          try {
            await bleService.sendDeviceCommand('mic_test_stop');
          } catch {
            // ignore
          }
          setMicTestActive(false);
          setMicTestPreview(null);
        }
        await bleService.sendDeviceCommand('start_detection');
        refresh();
      },
      stopSnoreDetection: async () => {
        await bleService.sendDeviceCommand('stop_detection');
        refresh();
      },
      startMicTest: async () => {
        if (readDetectionEnabled()) {
          throw new Error('Pause overnight detection before testing the mic.');
        }
        await bleService.sendDeviceCommand('mic_test_start');
        setMicTestActive(true);
        setMicTestPreview({
          snorePercent: 0,
          nonSnorePercent: 0,
          verdict: 'quiet',
          timestamp: Date.now(),
        });
        refresh();
      },
      stopMicTest: async () => {
        await bleService.sendDeviceCommand('mic_test_stop');
        setMicTestActive(false);
        setMicTestPreview(null);
        refresh();
      },
    }),
    [
      connected,
      pairedDevice,
      scanning,
      nearbyDevices,
      snoreDetectionEnabled,
      micTestActive,
      micTestPreview,
    ],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within DeviceProvider');
  }
  return context;
};
