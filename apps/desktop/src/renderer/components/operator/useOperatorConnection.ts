/**
 * The operator has no connection panel: the link is chosen by the administrator
 * (or is simply the last one used) and the screen connects by itself, retrying
 * until the vehicle answers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnectionStore } from '../../stores/connection-store';
import { useOperatorStore } from '../../stores/operator-store';
import { useSettingsStore } from '../../stores/settings-store';
import { connectOptionsFromMemory } from './operator-logic';

const FIRST_ATTEMPT_MS = 800;
const RETRY_MS = 5000;

export function useOperatorConnection() {
  const configured = useOperatorStore((s) => s.config.connection);
  const autoConnect = useOperatorStore((s) => s.config.autoConnect);
  const settingsReady = useSettingsStore((s) => s._isInitialized);
  const memory = useSettingsStore((s) => s.connectionMemory);
  const connectionState = useConnectionStore((s) => s.connectionState);
  const isConnecting = useConnectionStore((s) => s.isConnecting);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);

  const options = configured ?? (settingsReady ? connectOptionsFromMemory(memory) : null);
  const optionsKey = JSON.stringify(options);
  // The operator pressed "disconnect": stay off until they connect again themselves.
  const [heldOff, setHeldOff] = useState(false);
  const attempts = useRef(0);

  const linkUp = connectionState.isConnected;
  const busy = isConnecting || !!connectionState.isWaitingForHeartbeat || !!connectionState.isReconnecting;

  useEffect(() => {
    if (linkUp) attempts.current = 0;
  }, [linkUp]);

  useEffect(() => {
    if (!autoConnect || heldOff || linkUp || busy || optionsKey === 'null') return;
    const delay = attempts.current === 0 ? FIRST_ATTEMPT_MS : RETRY_MS;
    const id = setTimeout(() => {
      attempts.current += 1;
      void connect(JSON.parse(optionsKey));
    }, delay);
    return () => clearTimeout(id);
  }, [autoConnect, heldOff, linkUp, busy, optionsKey, connect]);

  const connectNow = useCallback(() => {
    setHeldOff(false);
    if (optionsKey !== 'null') void connect(JSON.parse(optionsKey));
  }, [optionsKey, connect]);

  const disconnectNow = useCallback(() => {
    setHeldOff(true);
    void disconnect();
  }, [disconnect]);

  return { options, linkUp, busy, connectionState, connectNow, disconnectNow };
}
