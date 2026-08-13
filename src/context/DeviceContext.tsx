import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BLEDevice } from '../types';
import { bleService } from '../services/mockBLEService';

interface DeviceContextValue {
  connected: boolean;
  pairedDevice: BLEDevice | null;
  scanning: boolean;
  nearbyDevices: BLEDevice[];
  scan: () => Promise<void>;
  pair: (device: BLEDevice, pin: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  unpair: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(bleService.getIsConnected());
  const [pairedDevice, setPairedDevice] = useState<BLEDevice | null>(bleService.getPairedDevice());
  const [scanning, setScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<BLEDevice[]>([]);

  const refresh = () => {
    setConnected(bleService.getIsConnected());
    setPairedDevice(bleService.getPairedDevice());
  };

  useEffect(() => {
    bleService.restoreSession().then(refresh);
    return bleService.subscribe(refresh);
  }, []);

  const value = useMemo<DeviceContextValue>(
    () => ({
      connected,
      pairedDevice,
      scanning,
      nearbyDevices,
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
        await bleService.disconnect();
        refresh();
      },
      unpair: async () => {
        await bleService.unpair();
        setNearbyDevices([]);
        refresh();
      },
    }),
    [connected, pairedDevice, scanning, nearbyDevices],
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
