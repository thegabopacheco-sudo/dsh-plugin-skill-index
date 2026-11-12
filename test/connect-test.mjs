// Test end-to-end de skill-index.
import path from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const packageDir = path.resolve(import.meta.dirname, '..');
const tmpDir = path.join(packageDir, 'test', 'tmp');
rmSync(tmpDir, { recursive: true, force: true });
const home = path.join(tmpDir, 'dsh-home');
const skillsRoot = path.join(tmpDir, 'skills');
mkdirSync(path.join(skillsRoot, 'office'), { recursive: true });
mkdirSync(path.join(skillsRoot, 'debug'), { recursive: true });
mkdirSync(path.join(home, 'skill-index'), { recursive: true });
writeFileSync(path.join(home, 'skill-index', 'config.json'), JSON.stringify({ skillsPaths: [skillsRoot] }), 'utf8');
writeFileSync(path.join(skillsRoot, 'office', 'SKILL.md'), ['---', 'name: office-docx', 'description: Crear y editar documentos Word', 'when_to_use: cuando el usuario pide un .docx', 'version: 1.2.0', '---', '', '# Office DOCX', '', 'Instrucciones de la skill office.'].join('\n'), 'utf8');
writeFileSync(path.join(skillsRoot, 'debug', 'SKILL.md'), ['# Debug', '', 'Skill sin frontmatter para depurar.'].join('\n'), 'utf8');
writeFileSync(path.join(skillsRoot, 'plain.md'), ['---', 'name: notas', 'description: Skill en archivo suelto', '---', '', 'Contenido de notas.'].join('\n'), 'utf8');

function makeClient() {
  const entry = process.env.SKILLSIDX_SERVER ? path.resolve(process.env.SKILLSIDX_SERVER) : path.join(packageDir, 'server.mjs');
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { SystemRoot: process.env.SystemRoot || 'C:\\Windows', PATH: process.env.PATH, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME || process.env.USERPROFILE, TEMP: process.env.TEMP, TMP: process.env.TMP, DSH_HOME: home }, stderr: 'pipe' });
  transport.stderr?.on('data', (c) => process.stderr.write(`[server] ${c}`));
  const client = new Client({ name: 'skillsidx-test', version: '1.0.0' }, { capabilities: {}, versionNegotiation: { mode: 'auto' } });
  return client.connect(transport).then(() => ({ client, transport }));
}
const textOf = (r) => (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');

const { client, transport } = await makeClient();
console.log('tools:', (await client.listTools()).tools.map((t) => t.name).join(', '));
const status = textOf(await client.callTool({ name: 'status', arguments: {} }));
console.log('--- status ---'); console.log(status);
console.log('indexa 3:', status.includes('Skills indexadas: 3'));
const index = textOf(await client.callTool({ name: 'index', arguments: {} }));
console.log('--- index ---'); console.log(index);
console.log('nombres y versiones:', index.includes('office-docx v1.2.0') && index.includes('notas') && index.includes('debug'));
const search = textOf(await client.callTool({ name: 'search', arguments: { query: 'word' } }));
console.log('search descripción:', search.includes('office-docx'));
const search2 = textOf(await client.callTool({ name: 'search', arguments: { query: 'depurar' } }));
console.log('search sin frontmatter:', search2.includes('debug'));
const get = textOf(await client.callTool({ name: 'get', arguments: { name: 'office-docx' } }));
console.log('--- get ---'); console.log(get.slice(0, 400));
console.log('get devuelve body:', get.includes('Instrucciones de la skill office'));
const missing = await client.callTool({ name: 'get', arguments: { name: 'no-existe' } });
console.log('inexistente isError:', missing.isError === true);
const empty = textOf(await client.callTool({ name: 'search', arguments: { query: 'zzz' } }));
console.log('sin resultados:', empty.includes('Sin resultados'));
await client.close(); try { await transport.close?.(); } catch {}
console.log('OK');
