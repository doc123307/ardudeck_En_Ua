/**
 * Companion Board Store — template selection dialog for companion board firmware/software.
 * Users pick a board + template, then get instructions and flash/install options.
 */
import { useState, useCallback } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Wifi,
  Radio,
  Video,
  Cpu,
  ExternalLink,
  Copy,
  Check,
  Usb,
  HardDrive,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import {
  COMPANION_TEMPLATES,
  BOARD_FAMILIES,
  CATEGORY_STYLE,
  FALLBACK_STYLE,
  type CompanionTemplate,
  type BoardFamily,
} from './companion-templates';
import { t as tr, enPlural } from '../../i18n';

// ── Per-template icons ──────────────────────────────────────────

const TEMPLATE_ICON: Record<string, LucideIcon> = {
  'dronebridge-wifi': Wifi,
  'dronebridge-espnow': Radio,
  'esp32-mavlink-bridge': Wifi,
  'pi-telemetry-bridge': Wifi,
  'pi-video-telemetry': Video,
  'rpanion-server': Cpu,
  'blueos': HardDrive,
  'pi-mavsdk-autonomy': Terminal,
  'openhd-air': Video,
  'jetson-cv-companion': Cpu,
};

const FLASH_METHOD_LABEL: Record<string, { label: string; icon: LucideIcon; description: string }> = {
  serial: { get label() { return tr('companion.CompanionStoreDialog.usbFlash'); }, icon: Usb, get description() { return tr('companion.CompanionStoreDialog.connectBoardViaUsbAndFlash'); } },
  image: { get label() { return tr('companion.CompanionStoreDialog.sdCardImage'); }, icon: HardDrive, get description() { return tr('companion.CompanionStoreDialog.downloadImageAndWriteToSd'); } },
  script: { get label() { return tr('companion.CompanionStoreDialog.installScript'); }, icon: Terminal, get description() { return tr('companion.CompanionStoreDialog.runInstallScriptOnTheBoard'); } },
};

// ── Board Selection View ────────────────────────────────────────

function BoardSelectionView({ onSelectBoard }: { onSelectBoard: (board: BoardFamily) => void }) {
  const boardEntries = Object.entries(BOARD_FAMILIES) as [BoardFamily, typeof BOARD_FAMILIES[BoardFamily]][];

  // Count templates per board
  const templateCounts = Object.fromEntries(
    boardEntries.map(([key]) => [key, COMPANION_TEMPLATES.filter((t) => t.board === key).length]),
  );

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-content-secondary">
        {tr('companion.CompanionStoreDialog.selectYourCompanionBoardToSee')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {boardEntries.map(([key, board]) => (
          <button
            key={key}
            onClick={() => onSelectBoard(key)}
            disabled={templateCounts[key] === 0}
            className="group text-left rounded-xl border border-subtle bg-surface hover:bg-surface transition-all duration-200 hover:border hover:shadow-lg hover:shadow-black/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={board.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-content group-hover:text-content transition-colors">
                    {board.name}
                  </div>
                  <div className="text-[11px] text-content-secondary leading-relaxed mt-1">
                    {board.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-subtle">
                <span className="text-[10px] text-content-tertiary">
                  {templateCounts[key]} {tr('companion.CompanionStoreDialog.template')}{templateCounts[key] !== 1 ? enPlural('s') : ''}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-content-tertiary group-hover:text-content-secondary transition-colors" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Template List View ──────────────────────────────────────────

function TemplateListView({
  board,
  onBack,
  onSelectTemplate,
}: {
  board: BoardFamily;
  onBack: () => void;
  onSelectTemplate: (template: CompanionTemplate) => void;
}) {
  const boardInfo = BOARD_FAMILIES[board];
  const templates = COMPANION_TEMPLATES.filter((t) => t.board === board);
  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <div className="p-5 max-h-[65vh] overflow-y-auto space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-content-secondary hover:text-content transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {tr('companion.CompanionStoreDialog.allBoards')}
      </button>

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={boardInfo.icon} />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium text-content">{boardInfo.name}</div>
          <div className="text-[10px] text-content-secondary">{templates.length} {tr('companion.CompanionStoreDialog.availableTemplates')}</div>
        </div>
      </div>

      {categories.map((cat) => {
        const style = CATEGORY_STYLE[cat] ?? FALLBACK_STYLE;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded border ${style.badge}`}>
                {cat}
              </span>
              <div className="flex-1 h-px bg-surface-raised" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {templates.filter((t) => t.category === cat).map((template) => {
                const Icon = TEMPLATE_ICON[template.id] ?? Cpu;
                const flash = FLASH_METHOD_LABEL[template.flashMethod];

                return (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template)}
                    className={`group text-left rounded-xl border-t-2 border border-subtle bg-surface hover:bg-surface transition-all duration-200 hover:border hover:shadow-lg hover:shadow-black/20 ${style.accent}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-2.5">
                        <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4.5 h-4.5 ${style.text}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-content group-hover:text-content transition-colors leading-tight">
                            {template.name}
                          </div>
                          <div className="text-[11px] text-content-secondary leading-relaxed mt-1 line-clamp-2">
                            {template.description}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-subtle">
                        {flash && (
                          <div className="flex items-center gap-1 text-[10px] text-content-tertiary">
                            <flash.icon className="w-3 h-3" />
                            <span>{flash.label}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-content-tertiary">
                          {template.boardVariants.length} {tr('companion.CompanionStoreDialog.board')}{template.boardVariants.length !== 1 ? enPlural('s') : ''}
                        </div>
                        <div className="flex-1" />
                        <ArrowRight className="w-3.5 h-3.5 text-content-tertiary group-hover:text-content-secondary transition-colors" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Template Detail View ────────────────────────────────────────

function TemplateDetailView({
  template,
  onBack,
}: {
  template: CompanionTemplate;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [esptoolAvailable, setEsptoolAvailable] = useState<boolean | null>(null);
  const [selectedPort, setSelectedPort] = useState('');
  const [ports, setPorts] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectedChip, setDetectedChip] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [flashResult, setFlashResult] = useState<{ success: boolean; message: string } | null>(null);
  const style = CATEGORY_STYLE[template.category] ?? FALLBACK_STYLE;
  const Icon = TEMPLATE_ICON[template.id] ?? Cpu;
  const flash = FLASH_METHOD_LABEL[template.flashMethod];

  // Check esptool availability and list ports on mount for serial flash templates
  useState(() => {
    if (template.flashMethod === 'serial') {
      window.electronAPI?.esp32CheckEsptool().then(setEsptoolAvailable);
      window.electronAPI?.listSerialPorts().then((result) => {
        if (result?.ports) setPorts(result.ports.map((port) => port.path));
      });
    }
  });

  const handleDetect = useCallback(async () => {
    if (!selectedPort) return;
    setDetecting(true);
    setDetectedChip(null);
    const result = await window.electronAPI?.esp32Detect(selectedPort);
    setDetectedChip(result?.chip ?? null);
    setDetecting(false);
  }, [selectedPort]);

  const handleFlash = useCallback(async () => {
    if (!selectedPort) return;
    setFlashing(true);
    setFlashResult(null);
    // Use first matching board variant as chip hint
    const chipHint = template.boardVariants[0]?.toLowerCase().replace('esp32-', 'esp32-') ?? 'esp32';
    const result = await window.electronAPI?.esp32Flash({
      port: selectedPort,
      chip: detectedChip?.toLowerCase() ?? chipHint,
      firmwarePath: '', // TODO: download firmware binary first
      eraseAll: true,
    });
    setFlashing(false);
    if (result) {
      setFlashResult({
        success: result.success,
        message: result.success ? tr('companion.CompanionStoreDialog.flashComplete') : (result.error ?? tr('companion.CompanionStoreDialog.flashFailed')),
      });
    }
  }, [selectedPort, detectedChip, template.boardVariants]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="p-5 max-h-[65vh] overflow-y-auto space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-content-secondary hover:text-content transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {tr('companion.CompanionStoreDialog.backToTemplates')}
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-6 h-6 ${style.text}`} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-content">{template.name}</h3>
          <p className="text-xs text-content-secondary mt-1">{template.description}</p>
          {template.projectName && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] text-content-tertiary">{tr('companion.CompanionStoreDialog.poweredBy')}</span>
              {template.projectUrl ? (
                <a
                  href={template.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(template.projectUrl, '_blank');
                  }}
                >
                  {template.projectName}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="text-[10px] text-content-secondary">{template.projectName}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Supported boards */}
      <div className="bg-surface rounded-xl border border-subtle p-4">
        <h4 className="text-xs font-medium text-content mb-2">{tr('companion.CompanionStoreDialog.supportedBoards')}</h4>
        <div className="flex flex-wrap gap-1.5">
          {template.boardVariants.map((variant) => (
            <span key={variant} className="px-2 py-0.5 bg-surface-raised rounded text-[11px] text-content-secondary">
              {variant}
            </span>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="bg-surface rounded-xl border border-subtle p-4">
        <h4 className="text-xs font-medium text-content mb-2">{tr('companion.CompanionStoreDialog.features')}</h4>
        <ul className="space-y-1.5">
          {template.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[11px] text-content-secondary">
              <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Requirements */}
      <div className="bg-surface rounded-xl border border-subtle p-4">
        <h4 className="text-xs font-medium text-content mb-2">{tr('companion.CompanionStoreDialog.requirements')}</h4>
        <ul className="space-y-1.5">
          {template.requirements.map((req) => (
            <li key={req} className="flex items-start gap-2 text-[11px] text-content-secondary">
              <span className="text-content-tertiary mt-0.5 shrink-0">-</span>
              {req}
            </li>
          ))}
        </ul>
      </div>

      {/* Setup instructions */}
      <div className="bg-surface rounded-xl border border-subtle p-4 space-y-3">
        <div className="flex items-center gap-2">
          {flash && <flash.icon className="w-4 h-4 text-content-secondary" />}
          <h4 className="text-xs font-medium text-content">
            {flash?.label ?? tr('companion.CompanionStoreDialog.setup')}: {flash?.description ?? ''}
          </h4>
        </div>

        {template.flashMethod === 'serial' && (
          <div className="space-y-3">
            {esptoolAvailable === false && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-xs text-red-400 font-medium">{tr('companion.CompanionStoreDialog.esptoolNotFound')}</p>
                <p className="text-[11px] text-red-400/70 mt-1">
                  {tr('companion.CompanionStoreDialog.installItWith')} <span className="font-mono">{tr('companion.CompanionStoreDialog.pipInstallEsptool')}</span>
                </p>
              </div>
            )}

            {esptoolAvailable !== false && (
              <>
                <div className="space-y-2">
                  <label className="block text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.serialPort')}</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPort}
                      onChange={(e) => { setSelectedPort(e.target.value); setDetectedChip(null); }}
                      className="flex-1 bg-surface-input border border-subtle rounded-lg px-3 py-2 text-xs text-content focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    >
                      <option value="">{tr('companion.CompanionStoreDialog.selectPort')}</option>
                      {ports.map((port) => (
                        <option key={port} value={port}>{port}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleDetect}
                      disabled={!selectedPort || detecting}
                      className="px-3 py-2 bg-surface-raised hover:bg-surface-raised disabled:opacity-40 text-content text-xs rounded-lg transition-colors"
                    >
                      {detecting ? tr('companion.CompanionStoreDialog.detecting') : tr('companion.CompanionStoreDialog.detect')}
                    </button>
                  </div>
                </div>

                {detectedChip && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400">{tr('companion.CompanionStoreDialog.detected')} {detectedChip}</span>
                  </div>
                )}

                {flashResult && (
                  <div className={`flex items-center gap-2 rounded-lg p-2.5 ${
                    flashResult.success
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    <span className={`text-xs ${flashResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {flashResult.message}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleFlash}
                  disabled={!selectedPort || flashing || esptoolAvailable !== true}
                  className="w-full py-2.5 bg-blue-600/80 hover:bg-blue-500/80 disabled:bg-surface-raised disabled:text-content-tertiary text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Usb className="w-4 h-4" />
                  {flashing ? tr('companion.CompanionStoreDialog.flashing') : tr('companion.CompanionStoreDialog.flashFirmware')}
                </button>

                <p className="text-[10px] text-content-tertiary text-center">
                  {tr('companion.CompanionStoreDialog.holdTheBootButtonOnYour')}
                </p>
              </>
            )}
          </div>
        )}

        {template.flashMethod === 'image' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.n1DownloadTheSdCardImage')}</p>
              <p className="text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.n2FlashToMicrosdUsingRaspberry')}</p>
              <p className="text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.n3InsertSdCardAndPower')}</p>
              <p className="text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.n4ConnectToTheBoardS')}</p>
            </div>
            {template.installCommand && (
              <div>
                <p className="text-[10px] text-content-secondary mb-1">{tr('companion.CompanionStoreDialog.orInstallOnAnExistingPi')}</p>
                <div className="relative">
                  <div className="bg-surface-input rounded-lg px-3 py-2 font-mono text-xs text-content-secondary pr-10 select-all overflow-x-auto">
                    {template.installCommand}
                  </div>
                  <button
                    onClick={() => handleCopy(template.installCommand!)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-raised text-content-tertiary hover:text-content-secondary transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {template.flashMethod === 'script' && template.installCommand && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.n1SshIntoYour')} {BOARD_FAMILIES[template.board].name}</p>
              <p className="text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.n2RunTheInstallCommandBelow')}</p>
              <p className="text-[11px] text-content-secondary">{tr('companion.CompanionStoreDialog.n3FollowTheOnScreenPrompts')}</p>
            </div>
            <div className="relative">
              <div className="bg-surface-input rounded-lg px-3 py-2 font-mono text-xs text-content-secondary pr-10 select-all overflow-x-auto">
                {template.installCommand}
              </div>
              <button
                onClick={() => handleCopy(template.installCommand!)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-raised text-content-tertiary hover:text-content-secondary transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project link */}
      {template.projectUrl && (
        <a
          href={template.projectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-2 text-xs text-content-secondary hover:text-content transition-colors"
          onClick={(e) => {
            e.preventDefault();
            window.open(template.projectUrl, '_blank');
          }}
        >
          {tr('companion.CompanionStoreDialog.viewProjectOnGithub')}
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// ── Main Dialog ─────────────────────────────────────────────────

interface CompanionStoreDialogProps {
  onClose: () => void;
}

export function CompanionStoreDialog({ onClose }: CompanionStoreDialogProps) {
  const [selectedBoard, setSelectedBoard] = useState<BoardFamily | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CompanionTemplate | null>(null);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface-solid rounded-2xl border border-subtle w-full max-w-2xl mx-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-content">{tr('companion.CompanionStoreDialog.companionBoardStore')}</h2>
              <p className="text-[10px] text-content-secondary mt-0.5">
                {tr('companion.CompanionStoreDialog.preConfiguredFirmwareAndSoftwareFor')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface text-content-secondary hover:text-content transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {selectedTemplate ? (
          <TemplateDetailView
            template={selectedTemplate}
            onBack={() => setSelectedTemplate(null)}
          />
        ) : selectedBoard ? (
          <TemplateListView
            board={selectedBoard}
            onBack={() => setSelectedBoard(null)}
            onSelectTemplate={setSelectedTemplate}
          />
        ) : (
          <BoardSelectionView onSelectBoard={setSelectedBoard} />
        )}
      </div>
    </div>
  );
}
