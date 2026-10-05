/**
 * The look of the operator's controls: one compact "chip" for every kind of control, so a
 * light, an RC switch and the joystick read the same way. Off is quiet; on is filled with
 * the control's colour, so the state is clear at a glance from across a table.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  ArrowUpDown, Camera, Car, Droplet, Eye, Fan, Flame, Flashlight, Gauge, Lightbulb, Lock, Megaphone, Power, Radio,
  Shield, Siren, Sun, Target, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { OperatorColor, OperatorIcon } from '../../../shared/operator-panel';

export const ICON_COMPONENTS: Record<OperatorIcon, LucideIcon> = {
  power: Power, lightbulb: Lightbulb, car: Car, sun: Sun, flashlight: Flashlight, eye: Eye, siren: Siren, zap: Zap,
  fan: Fan, megaphone: Megaphone, camera: Camera, arrowUpDown: ArrowUpDown, gauge: Gauge, wrench: Wrench, lock: Lock,
  radio: Radio, droplet: Droplet, flame: Flame, target: Target, shield: Shield,
};

/** A control that is on: filled with its colour. Readable on the light theme as on the dark one. */
export const ON_STYLE: Record<OperatorColor, string> = {
  white: 'border-slate-300 bg-white text-slate-900 shadow-[0_0_10px_rgba(255,255,255,0.35)]',
  amber: 'border-amber-400 bg-amber-400 text-slate-900',
  red: 'border-red-500 bg-red-500 text-white',
  ir: 'border-violet-500 bg-violet-500 text-white',
  green: 'border-emerald-500 bg-emerald-500 text-white',
  blue: 'border-sky-500 bg-sky-500 text-white',
};

/** The swatch of a colour, for the administrator's colour picker. */
export const SWATCH: Record<OperatorColor, string> = {
  white: 'bg-white ring-1 ring-slate-400/70', amber: 'bg-amber-400', red: 'bg-red-500', ir: 'bg-violet-500', green: 'bg-emerald-500', blue: 'bg-sky-500',
};

const CHIP = 'relative inline-flex h-8 shrink-0 select-none items-center gap-1 rounded-md border px-1.5 text-xs font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const OFF = 'border-subtle bg-surface-raised text-content-secondary hover:border-content-tertiary/60 hover:text-content';
export const WARN_STYLE = 'border-amber-400 bg-amber-400/20 text-amber-500 animate-pulse';

export type ChipTone = OperatorColor | 'off' | 'warn';

export function chipClass(tone: ChipTone, extra = ''): string {
  const look = tone === 'off' ? OFF : tone === 'warn' ? WARN_STYLE : ON_STYLE[tone];
  return `${CHIP} ${look} ${extra}`;
}

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ChipTone;
  icon?: LucideIcon;
  label?: ReactNode;
  /** Icon only, square: for the view tools. */
  square?: boolean;
};

/** One control on the bar. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ tone = 'off', icon: Icon, label, square, className = '', children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" {...rest} className={chipClass(tone, `${square ? 'w-8 justify-center px-0' : ''} ${className}`)}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label !== undefined && <span className="max-w-[7rem] truncate">{label}</span>}
      {children}
    </button>
  );
});

/** A frame that holds a label and its own small buttons (a 3-position switch, a slider, cruise +/-). */
/** `label` null: icon only (the tooltip names it). */
export function ChipFrame({ icon: Icon, label, tip, children, active }: { icon?: LucideIcon; label: ReactNode | null; tip?: string; children: ReactNode; active?: boolean }) {
  return (
    <div data-tip={tip} className={`${CHIP} ${OFF} gap-0.5 py-0.5 pl-1.5 pr-0.5 hover:border-subtle hover:text-content-secondary`}>
      {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-emerald-400' : ''}`} />}
      {label !== null && <span className="mr-0.5 max-w-[7rem] truncate">{label}</span>}
      {children}
    </div>
  );
}

/** A small button inside a ChipFrame. */
export function Segment({ on, tone = 'green', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; tone?: OperatorColor }) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex h-6 w-6 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? ON_STYLE[tone] : 'text-content-tertiary hover:bg-surface hover:text-content'
      } ${className}`}
    />
  );
}

/** The thin line between groups of controls. */
export function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 shrink-0 border-l border-subtle" />;
}
