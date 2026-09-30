/**
 * Documentation content for the Lua Graph Editor.
 * Each section imports its content from a .md file.
 */
import {
  Rocket,
  Cpu,
  Cable,
  BookOpen,
  Code2,
  Cog,
  Lightbulb,
} from 'lucide-react';
import type { DocSection } from './docs-types';

import gettingStarted from './getting-started.md?raw';
import nodeReference from './node-reference.md?raw';
import connections from './connections.md?raw';
import examples from './examples.md?raw';
import apiReference from './api-reference.md?raw';
import compilation from './compilation.md?raw';
import tipsAndLimitations from './tips-and-limitations.md?raw';
import { t } from '../../../i18n';

export const DOC_SECTIONS: DocSection[] = [
  { id: 'getting-started', get title() { return t('lua_graph.docs_content.gettingStarted'); }, icon: Rocket, content: gettingStarted },
  { id: 'node-reference', get title() { return t('lua_graph.docs_content.nodeReference'); }, icon: Cpu, content: nodeReference },
  { id: 'connections', get title() { return t('lua_graph.docs_content.connections'); }, icon: Cable, content: connections },
  { id: 'examples', get title() { return t('lua_graph.docs_content.examples'); }, icon: BookOpen, content: examples },
  { id: 'api-reference', get title() { return t('lua_graph.docs_content.ardupilotApi'); }, icon: Code2, content: apiReference },
  { id: 'compilation', get title() { return t('lua_graph.docs_content.compilation'); }, icon: Cog, content: compilation },
  { id: 'tips', get title() { return t('lua_graph.docs_content.tipsLimits'); }, icon: Lightbulb, content: tipsAndLimitations },
];
