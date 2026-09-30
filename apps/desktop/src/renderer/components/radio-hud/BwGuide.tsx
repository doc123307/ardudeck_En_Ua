/**
 * On-demand guide for monochrome radios (Pocket, Boxer, Zorro, TX12, X9D).
 *
 * These radios have no widget system, so the HUD arrives as a telemetry
 * script on a screen the pilot has to know how to reach. Nothing here is
 * discoverable from the radio itself, so it is spelled out with pictures of
 * what they will actually see - but only when asked for.
 */

import { X, Download, BookOpen, LayoutGrid, Volume2, Activity } from 'lucide-react';
import { t as tr } from '../../i18n';

/** The 128x64 screen, drawn to scale with its regions called out. */
function ScreenMap() {
  const w = 128;
  const h = 64;
  return (
    <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} className="w-full max-w-sm" role="img" aria-label={tr('radio_hud.BwGuide.screenLayout')}>
      <rect x={0} y={0} width={w} height={h} rx={2} className="fill-[#c9d2bd] stroke-[#242b1f]" strokeWidth={1} />
      {/* top strip */}
      <rect x={0} y={0} width={w} height={8} className="fill-[#242b1f]" />
      <text x={2} y={6} fontSize={5.5} fontFamily="monospace" className="fill-[#c9d2bd]">LOITER</text>
      <text x={52} y={6} fontSize={5.5} fontFamily="monospace" className="fill-[#c9d2bd]">00:42</text>
      <text x={104} y={6} fontSize={5.5} fontFamily="monospace" className="fill-[#c9d2bd]">SRS72</text>
      {/* big readout + left column */}
      <text x={1} y={24} fontSize={15} fontFamily="monospace" fontWeight="700" className="fill-[#242b1f]">23.4</text>
      <text x={44} y={18} fontSize={6} fontFamily="monospace" className="fill-[#242b1f]">V</text>
      {['3.92v/c 62%', '11.5A', '1830mAh', 't34%'].map((t, i) => (
        <text key={t} x={1} y={32 + i * 8} fontSize={5.5} fontFamily="monospace" className="fill-[#242b1f]">{t}</text>
      ))}
      {/* horizon */}
      <rect x={50} y={9} width={42} height={46} className="fill-none stroke-[#242b1f]" strokeWidth={1} />
      <line x1={54} y1={34} x2={88} y2={28} className="stroke-[#242b1f]" strokeWidth={1} />
      <rect x={61} y={47} width={20} height={8} className="fill-[#242b1f]" />
      <text x={64} y={53.5} fontSize={5.5} fontFamily="monospace" className="fill-[#c9d2bd]">200</text>
      {/* right column */}
      {['A123m', 'S10.0', 'V-1.5', '11s3D', 'H100m'].map((t, i) => (
        <text key={t} x={96} y={14 + i * 8} fontSize={5.5} fontFamily="monospace" className="fill-[#242b1f]">{t}</text>
      ))}
      {/* bottom strip */}
      <rect x={0} y={56} width={w} height={8} className="fill-[#242b1f]" />
      <text x={2} y={62} fontSize={5.5} fontFamily="monospace" className="fill-[#c9d2bd]">{tr('radio_hud.BwGuide.ekf3Imu0IsUsingGps')}</text>
    </svg>
  );
}

/** Where PAGE lives on a Pocket-class radio. */
function RadioFace() {
  return (
    <svg viewBox="0 0 150 90" className="w-full max-w-[220px]" role="img" aria-label={tr('radio_hud.BwGuide.radioFront')}>
      <rect x={1} y={1} width={148} height={88} rx={10} className="fill-surface-input stroke-subtle" strokeWidth={1.5} />
      <rect x={40} y={10} width={70} height={36} rx={2} className="fill-[#c9d2bd] stroke-subtle" strokeWidth={1} />
      <rect x={40} y={10} width={70} height={5} className="fill-[#242b1f]" />
      <text x={44} y={30} fontSize={9} fontFamily="monospace" fontWeight="700" className="fill-[#242b1f]">23.4V</text>
      <circle cx={20} cy={62} r={11} className="fill-surface stroke-subtle" strokeWidth={1.5} />
      <circle cx={130} cy={62} r={11} className="fill-surface stroke-subtle" strokeWidth={1.5} />
      <rect x={52} y={56} width={20} height={11} rx={3} className="fill-teal-500/25 stroke-teal-400" strokeWidth={1.5} />
      <text x={55} y={64} fontSize={7} className="fill-teal-300">PAGE</text>
      <rect x={78} y={56} width={20} height={11} rx={3} className="fill-surface stroke-subtle" strokeWidth={1} />
      <text x={81} y={64} fontSize={7} className="fill-content-secondary">SYS</text>
      <text x={46} y={80} fontSize={6.5} className="fill-content-secondary">{tr('radio_hud.BwGuide.pressPageFromTheMainView')}</text>
    </svg>
  );
}

interface Step {
  Icon: typeof Download;
  color: string;
  title: string;
  body: React.ReactNode;
  figure?: React.ReactNode;
}

const STEPS: Step[] = [
  {
    Icon: Download,
    color: 'text-sky-400',
    get title() { return tr('radio_hud.BwGuide.installIt'); },
    body: (
      <>
        {tr('radio_hud.BwGuide.powerTheRadioConnectUsbChoose')} <span className="text-content">{tr('radio_hud.BwGuide.usbStorageSd')}</span> {tr('radio_hud.BwGuide.onItsScreenThenPressInstall')}
      </>
    ),
  },
  {
    Icon: BookOpen,
    color: 'text-teal-400',
    get title() { return tr('radio_hud.BwGuide.openIt'); },
    body: (
      <>
        {tr('radio_hud.BwGuide.ejectTheCardUnplugUsbThen')} <span className="text-content">PAGE</span> {tr('radio_hud.BwGuide.fromTheMainViewUntilThe')}
      </>
    ),
    figure: <RadioFace />,
  },
  {
    Icon: Activity,
    color: 'text-emerald-400',
    get title() { return tr('radio_hud.BwGuide.readIt'); },
    body: (
      <>
        {tr('radio_hud.BwGuide.topStripFlightModeArmedTimer')} <span className="text-content">S</span> {tr('radio_hud.BwGuide.beforeTheSignalFigureMeansThe')}
      </>
    ),
    figure: <ScreenMap />,
  },
  {
    Icon: LayoutGrid,
    color: 'text-violet-400',
    get title() { return tr('radio_hud.BwGuide.changeWhatItShows'); },
    body: (
      <>
        {tr('radio_hud.BwGuide.press')} <span className="text-content">{tr('radio_hud.BwGuide.editSlots')}</span>{tr('radio_hud.BwGuide.clickAnySlotInThePreview')} <span className="text-content">{tr('radio_hud.BwGuide.empty')}</span> {tr('radio_hud.BwGuide.andItsNeighbourGrowsIntoThe')}
      </>
    ),
  },
  {
    Icon: Volume2,
    color: 'text-amber-400',
    get title() { return tr('radio_hud.BwGuide.listenToIt'); },
    body: (
      <>
        {tr('radio_hud.BwGuide.theCalloutsPlayWhetherOrNot')}
      </>
    ),
  },
];

export function BwGuide({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] overflow-auto bg-surface-raised border border-subtle rounded-xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface-raised">
          <div>
            <h3 className="text-sm font-medium text-content">{tr('radio_hud.BwGuide.theHudOnAMonochromeRadio')}</h3>
            <p className="text-xs text-content-secondary">{tr('radio_hud.BwGuide.pocketBoxerZorroTx12Mt12T')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-content-secondary hover:text-content hover:bg-surface-input transition-colors"
            data-tip={tr('radio_hud.BwGuide.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <div key={step.title} className="bg-surface border border-subtle rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-surface-input">
                  <step.Icon className={`w-4 h-4 ${step.color}`} />
                </div>
                <h4 className="text-sm font-medium text-content">
                  <span className="text-content-secondary mr-1.5">{i + 1}.</span>{step.title}
                </h4>
              </div>
              <p className="text-xs text-content-secondary leading-relaxed">{step.body}</p>
              {step.figure && <div className="mt-1 flex justify-center">{step.figure}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
