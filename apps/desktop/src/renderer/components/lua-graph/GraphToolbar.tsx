/**
 * Toolbar - file operations, undo/redo, validation status.
 */
import { useCallback, useState } from 'react';
import {
  FilePlus,
  FolderOpen,
  Save,
  FileCode,
  Upload,
  Undo2,
  Redo2,
  BookTemplate,
  BookOpen,
} from 'lucide-react';
import { useLuaGraphStore } from '../../stores/lua-graph-store';
import { compileGraph } from './lua-compiler';
import { TemplateDialog } from './TemplateDialog';
import { DocsDialog } from './docs/DocsDialog';
import { ConfirmDialog } from './ConfirmDialog';
import type { GraphFile } from './lua-graph-types';
import { t, enPlural } from '../../i18n';

export function GraphToolbar() {
  const {
    graphName,
    setGraphName,
    isDirty,
    newGraph,
    loadGraph,
    setFilePath,
    toGraphFile,
    nodes,
    edges,
    runIntervalMs,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useLuaGraphStore();

  const [showTemplates, setShowTemplates] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [exportErrors, setExportErrors] = useState<string[] | null>(null);

  const handleNew = useCallback(() => {
    if (isDirty) {
      setShowNewConfirm(true);
    } else {
      newGraph();
    }
  }, [isDirty, newGraph]);

  const handleOpen = useCallback(async () => {
    try {
      const result = await window.electronAPI.luaGraphOpen();
      if (result.success && result.data) {
        const file = result.data as GraphFile;
        loadGraph(file);
        if (result.filePath) setFilePath(result.filePath);
      }
    } catch (err) {
      console.error('Failed to open graph:', err);
    }
  }, [loadGraph, setFilePath]);

  const handleSave = useCallback(async () => {
    try {
      const file = toGraphFile();
      const result = await window.electronAPI.luaGraphSave(file);
      if (result.success && result.filePath) {
        setFilePath(result.filePath);
        useLuaGraphStore.setState({ isDirty: false });
      }
    } catch (err) {
      console.error('Failed to save graph:', err);
    }
  }, [toGraphFile, setFilePath]);

  const handleExportLua = useCallback(async () => {
    const result = compileGraph(nodes, edges, graphName, runIntervalMs);
    if (!result.success) {
      setExportErrors(result.errors);
      return;
    }
    try {
      await window.electronAPI.luaGraphExportLua(result.code, graphName);
    } catch (err) {
      console.error('Failed to export Lua:', err);
    }
  }, [nodes, edges, graphName, runIntervalMs]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo()) redo();
        } else {
          if (canUndo()) undo();
        }
      }
    },
    [handleSave, undo, redo, canUndo, canRedo],
  );

  return (
    <>
      <div
        className="flex items-center gap-1 px-3 py-1.5 bg-surface border-b border-subtle"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Graph name */}
        <input
          type="text"
          value={graphName}
          onChange={(e) => setGraphName(e.target.value)}
          className="text-sm font-medium text-content bg-transparent border-b border-transparent hover:border-default focus:border-blue-500/50 focus:outline-none mr-3 w-48"
        />

        {isDirty && (
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2" title={t('lua_graph.GraphToolbar.unsavedChanges')} />
        )}

        <div className="w-px h-5 bg-subtle mx-1" />

        {/* File operations */}
        <ToolbarButton icon={FilePlus} label={t('lua_graph.GraphToolbar.new')} onClick={handleNew} />
        <ToolbarButton icon={FolderOpen} label={t('lua_graph.GraphToolbar.open')} onClick={handleOpen} />
        <ToolbarButton icon={Save} label={t('lua_graph.GraphToolbar.save')} onClick={handleSave} />
        <ToolbarButton icon={BookTemplate} label={t('lua_graph.GraphToolbar.templates')} onClick={() => setShowTemplates(true)} />
        <ToolbarButton icon={BookOpen} label={t('lua_graph.GraphToolbar.docs')} onClick={() => setShowDocs(true)} />

        <div className="w-px h-5 bg-subtle mx-1" />

        <ToolbarButton icon={FileCode} label={t('lua_graph.GraphToolbar.exportLua')} onClick={handleExportLua} accent />

        <div className="w-px h-5 bg-subtle mx-1" />

        {/* Undo / Redo */}
        <ToolbarButton icon={Undo2} label={t('lua_graph.GraphToolbar.undo')} onClick={undo} disabled={!canUndo()} />
        <ToolbarButton icon={Redo2} label={t('lua_graph.GraphToolbar.redo')} onClick={redo} disabled={!canRedo()} />

        <div className="flex-1" />

        {/* Node count */}
        <span className="text-[10px] text-content-secondary">
          {nodes.length} {t('lua_graph.GraphToolbar.node')}{nodes.length !== 1 ? enPlural('s') : ''} | {edges.length} {t('lua_graph.GraphToolbar.connection')}{edges.length !== 1 ? enPlural('s') : ''}
        </span>
      </div>

      {showTemplates && <TemplateDialog onClose={() => setShowTemplates(false)} />}
      {showDocs && <DocsDialog onClose={() => setShowDocs(false)} />}

      {showNewConfirm && (
        <ConfirmDialog
          title={t('lua_graph.GraphToolbar.unsavedChanges')}
          message={t('lua_graph.GraphToolbar.yourCurrentGraphHasUnsavedChanges')}
          confirmLabel={t('lua_graph.GraphToolbar.newGraph')}
          cancelLabel={t('lua_graph.GraphToolbar.goBack')}
          onConfirm={() => {
            newGraph();
            setShowNewConfirm(false);
          }}
          onCancel={() => setShowNewConfirm(false)}
        />
      )}

      {exportErrors && (
        <ConfirmDialog
          title={t('lua_graph.GraphToolbar.compilationErrors')}
          message={exportErrors.join('\n')}
          confirmLabel="OK"
          cancelLabel={t('lua_graph.GraphToolbar.close')}
          onConfirm={() => setExportErrors(null)}
          onCancel={() => setExportErrors(null)}
        />
      )}
    </>
  );
}

// ── Toolbar Button ──────────────────────────────────────────────

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors
        ${disabled
          ? 'text-content-tertiary cursor-not-allowed'
          : accent
            ? 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'
            : 'text-content-secondary hover:bg-surface-raised hover:text-content'
        }
      `}
      title={label}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
