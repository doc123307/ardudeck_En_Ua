/**
 * A button that only acts after being held down: for actions that must not happen
 * from a stray click (arming, disarming). The fill shows how much longer to hold.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface HoldButtonProps {
  onConfirm: () => void;
  holdMs?: number;
  disabled?: boolean;
  className?: string;
  /** Colour of the fill that grows while held. */
  fillClassName?: string;
  tip?: string;
  children: ReactNode;
}

export function HoldButton({ onConfirm, holdMs = 1500, disabled = false, className = '', fillClassName = 'bg-white/30', tip, children }: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useRef(onConfirm);
  confirm.current = onConfirm;

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const start = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0 || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      confirm.current();
    }, holdMs);
  };

  // Releasing outside the window or losing focus must not leave a hold running.
  useEffect(() => {
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);

  return (
    <button
      type="button"
      disabled={disabled}
      data-tip={tip}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative select-none overflow-hidden disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 ${fillClassName}`}
        style={{ width: holding ? '100%' : '0%', transition: holding ? `width ${holdMs}ms linear` : 'none' }}
      />
      <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
