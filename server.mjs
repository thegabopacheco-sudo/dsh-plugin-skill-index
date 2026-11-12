#!/usr/bin/env node
// dsh-plugin-skill-index — índice local de skills (SKILL.md).
// Tools: status, index, search, get.

import path from 'node:path';
import os from 'node:os';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

const VERSION = '0.1.0';
const DSH_HOME = (() => {
  const v = process.env.DSH_HOME && process.env.DSH_HOME.trim();
  return v || path.join(process.env.USERPROFILE || process.env.HOME || os.homedir(), '.dsh');
})();
const CONFIG_FILE = path.join(DSH_HOME, 'skill-index', 'config.json');
const CACHE_DIR = path.join(DSH_HOME, 'cache', 'skill-index');
const MAX_SKILL_CHARS = 120000;
const log = (m) => process.stderr.write(`[skillsidx] ${m}\n`);

function loadConfig() {
  try { if (existsSync(CONFIG_FILE)) return { skillsPaths: [], ...(JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) || {}) }; } catch { /* defaults */ }
  return { skillsPaths: [] };
}
function roots() {
  const configured = loadConfig().skillsPaths;
  return (Array.isArray(configured) && configured.length ? configured : [path.join(DSH_HOME, 'skills')]).map((item) => path.resolve(item));
}
function parseFrontmatter(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) return { meta: {}, body: text.trim() };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(match[0].length).trim() };
}
function scanSkills() {
  const skills = [];
  for (const root of roots()) {
    if (!existsSync(root)) continue;
    let entries = [];
    try { entries = readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const skillFile = entry.isDirectory() ? path.join(root, entry.name, 'SKILL.md') : entry.isFile() && entry.name.endsWith('.md') ? path.join(root, entry.name) : null;
      if (!skillFile || !existsSync(skillFile)) continue;
      const stat = statSync(skillFile);
      if (stat.size > MAX_SKILL_CHARS) continue;
      let text = '';
      try { text = readFileSync(skillFile, 'utf8'); } catch { continue; }
      const { meta, body } = parseFrontmatter(text);
      const fallbackName = entry.isDirectory() ? entry.name : path.basename(entry.name, '.md');
      skills.push({ name: String(meta.name || fallbackName).trim(), description: meta.description || '', whenToUse: meta.when_to_use || meta['when-to-use'] || meta.whentouse || '', version: meta.version || '', file: skillFile, body, chars: text.length });
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}
function findSkill(skills, ref) {
  const wanted = String(ref || '').trim().toLowerCase();
  return skills.find((skill) => skill.name.toLowerCase() === wanted) || skills.find((skill) => skill.name.toLowerCase().includes(wanted));
}
function textResult(text) { return { content: [{ type: 'text', text }] }; }

function buildInstructions() {
  return [
    'Skill Index: índice de skills locales del harness (SKILL.md).',
    '',
    `Rutas: ${roots().join(', ')}`,
    '',
    'Herramientas: status, index, search, get.',
    '',
    'Reglas:',
    '- Solo lectura: no modifica skills.',
    '- Usa search para encontrar una skill por descripción y get para leerla completa.',
    '- Muestra solo lo que existe en los archivos; no inventes skills.',
  ].join('\n');
}

function buildServer() {
  const server = new McpServer({ name: 'dsh-plugin-skill-index', version: VERSION }, { capabilities: { tools: {} }, instructions: buildInstructions() });

  server.registerTool(
    'status',
    { title: 'Estado', description: 'Rutas, cantidad de skills y modo.', inputSchema: z.object({}) },
    async () => {
      const skills = scanSkills();
      return textResult([`Skills indexadas: ${skills.length}`, `Rutas: ${roots().join(', ')}`, 'Modo: solo lectura'].join('\n'));
    },
  );

  server.registerTool(
    'index',
    { title: 'Listar skills', description: 'Lista skills con nombre, descripción y cuándo usarlas.', inputSchema: z.object({ limit: z.number().int().min(1).max(500).optional() }) },
    async (args) => {
      const skills = scanSkills().slice(0, args.limit ?? 200);
      if (skills.length === 0) return textResult(`Sin skills en ${roots().join(', ')}.`);
      return textResult(skills.map((skill) => `- ${skill.name}${skill.version ? ` v${skill.version}` : ''} — ${skill.description || '(sin descripción)'}${skill.whenToUse ? ` · cuándo: ${skill.whenToUse}` : ''}`).join('\n'));
    },
  );

  server.registerTool(
    'search',
    { title: 'Buscar skills', description: 'Busca por nombre, descripción o cuándo usarla.', inputSchema: z.object({ query: z.string().min(2).max(120), limit: z.number().int().min(1).max(50).optional() }) },
    async (args) => {
      const query = args.query.toLowerCase();
      const skills = scanSkills().filter((skill) => `${skill.name} ${skill.description} ${skill.whenToUse} ${skill.body}`.toLowerCase().includes(query)).slice(0, args.limit ?? 20);
      if (skills.length === 0) return textResult(`Sin resultados para "${args.query}".`);
      return textResult(skills.map((skill) => `- ${skill.name} — ${skill.description || '(sin descripción)'} (${skill.file})`).join('\n'));
    },
  );

  server.registerTool(
    'get',
    { title: 'Leer skill', description: 'Devuelve el contenido completo de una skill.', inputSchema: z.object({ name: z.string().min(1) }) },
    async (args) => {
      const skill = findSkill(scanSkills(), args.name);
      if (!skill) throw new Error(`skill no encontrada: ${args.name}`);
      return textResult([`# ${skill.name}${skill.version ? ` v${skill.version}` : ''}`, skill.description ? `> ${skill.description}` : '', skill.whenToUse ? `Cuándo usar: ${skill.whenToUse}` : '', '', skill.body].filter((line) => line !== undefined).join('\n'));
    },
  );

  return server;
}

try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* ignora */ }
log(`rutas: ${roots().join(', ')}`);
serveStdio(buildServer, { onerror: (e) => log(`serveStdio: ${e.message}`) });
process.on('uncaughtException', (e) => log(`excepción: ${e.message}`));
process.on('unhandledRejection', (e) => log(`rechazo: ${e && e.message ? e.message : String(e)}`));
