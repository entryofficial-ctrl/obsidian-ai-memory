import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  access,
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VAULT_ROOT = path.resolve(process.env.AI_MEMORY_HOME || path.join(HERE, '..', '..'));
const CLAUDE_PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');
const SEARCH_EXCLUDED_DIRS = new Set(['.git', '.obsidian', '.system', 'Templates', 'node_modules']);
const MAX_SEARCH_FILE_BYTES = 1024 * 1024;
const MAX_CAPTURE_CHARS = 14000;
const execFileAsync = promisify(execFile);

function koreanNowParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(function (part) {
    return [part.type, part.value];
  }));
  return {
    date: parts.year + '-' + parts.month + '-' + parts.day,
    time: parts.hour + ':' + parts.minute + ':' + parts.second,
    compactTime: parts.hour + parts.minute + parts.second,
    iso: parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second + '+09:00'
  };
}

export function slugify(value) {
  const normalized = String(value || 'general')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'general';
}

export function projectFromCwd(cwd) {
  let current = path.resolve(cwd || process.cwd());
  const root = path.parse(current).root;
  while (current !== root) {
    try {
      if (requireStatSync(path.join(current, '.git'))) {
        return slugify(path.basename(current));
      }
    } catch {
      break;
    }
    current = path.dirname(current);
  }
  return slugify(path.basename(path.resolve(cwd || process.cwd())));
}

function requireStatSync(target) {
  try {
    const fs = process.getBuiltinModule('node:fs');
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

function yamlValue(value) {
  return '"' + String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ') + '"';
}

function safeRelativePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) {
    throw new Error('A non-empty relative Markdown path is required.');
  }
  const target = path.resolve(VAULT_ROOT, normalized);
  const rootPrefix = VAULT_ROOT.endsWith(path.sep) ? VAULT_ROOT : VAULT_ROOT + path.sep;
  if (target !== VAULT_ROOT && !target.startsWith(rootPrefix)) {
    throw new Error('Path escapes the AI-Memory vault.');
  }
  if (path.extname(target).toLowerCase() !== '.md') {
    throw new Error('AI-Memory only writes Markdown files.');
  }
  return { target: target, relative: path.relative(VAULT_ROOT, target).replace(/\\/g, '/') };
}

export function sanitizeText(input) {
  let text = String(input || '');
  let redactions = 0;
  const replacements = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi, '[REDACTED PRIVATE KEY]'],
    [/\bsk-(?:proj-|ant-|live-)?[A-Za-z0-9_-]{16,}\b/g, '[REDACTED API KEY]'],
    [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, '[REDACTED GITHUB TOKEN]'],
    [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED AWS ACCESS KEY]'],
    [/\bBearer\s+[A-Za-z0-9._~+\/=-]{16,}\b/gi, 'Bearer [REDACTED]'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED JWT]']
  ];
  for (const entry of replacements) {
    text = text.replace(entry[0], function () {
      redactions += 1;
      return entry[1];
    });
  }
  text = text.replace(
    /^(\s*(?:export\s+)?(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)\s*[:=]\s*)(.+)$/gim,
    function (_match, prefix, value) {
      const trimmed = String(value).trim();
      if (/^(?:\$\{?[A-Z0-9_]+\}?|process\.env\.|os\.environ|<[^>]+>|\[REDACTED)/i.test(trimmed)) {
        return prefix + value;
      }
      redactions += 1;
      return prefix + '[REDACTED]';
    }
  );
  return { text: text, redactions: redactions };
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readVaultFile(relativePath) {
  const resolved = safeRelativePath(relativePath);
  return readFile(resolved.target, 'utf8');
}

export async function writeVaultFile(relativePath, content, mode) {
  const resolved = safeRelativePath(relativePath);
  const sanitized = sanitizeText(content);
  await mkdir(path.dirname(resolved.target), { recursive: true });
  let output = sanitized.text;
  if (mode === 'append' && await exists(resolved.target)) {
    const existing = await readFile(resolved.target, 'utf8');
    output = existing.replace(/\s*$/, '') + '\n\n' + sanitized.text.replace(/^\s*/, '');
  }
  const temporary = resolved.target + '.tmp-' + process.pid + '-' + Date.now();
  await writeFile(temporary, output, 'utf8');
  await rename(temporary, resolved.target);
  return { path: resolved.relative, redactions: sanitized.redactions, bytes: Buffer.byteLength(output) };
}

async function walkMarkdown(directory, results) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && SEARCH_EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push(fullPath);
    }
  }
}

function queryTokens(query) {
  const matches = String(query || '').toLowerCase().match(/[\p{L}\p{N}._/-]{2,}/gu) || [];
  return Array.from(new Set(matches)).slice(0, 16);
}

function occurrences(haystack, needle) {
  if (!needle) {
    return 0;
  }
  let count = 0;
  let position = 0;
  while ((position = haystack.indexOf(needle, position)) !== -1) {
    count += 1;
    position += needle.length;
    if (count >= 20) {
      break;
    }
  }
  return count;
}

function bestSnippet(content, tokens) {
  const lines = content.split(/\r?\n/);
  let bestIndex = 0;
  let bestScore = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const lower = lines[index].toLowerCase();
    const score = tokens.reduce(function (total, token) {
      return total + occurrences(lower, token);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  const start = Math.max(0, bestIndex - 1);
  const end = Math.min(lines.length, bestIndex + 3);
  return lines.slice(start, end).join('\n').trim().slice(0, 900);
}

export async function searchMemory(query, options) {
  const settings = options || {};
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return [];
  }
  const files = [];
  await walkMarkdown(VAULT_ROOT, files);
  const normalizedQuery = String(query).trim().toLowerCase();
  const project = slugify(settings.project || '');
  const limit = Math.max(1, Math.min(Number(settings.limit || 8), 20));
  const matches = [];
  for (const file of files) {
    let metadata;
    try {
      metadata = await stat(file);
    } catch {
      continue;
    }
    if (metadata.size > MAX_SEARCH_FILE_BYTES) {
      continue;
    }
    let content;
    try {
      content = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    const relative = path.relative(VAULT_ROOT, file).replace(/\\/g, '/');
    const lowerPath = relative.toLowerCase();
    const lowerContent = content.toLowerCase();
    let score = 0;
    if (normalizedQuery.length >= 3 && lowerContent.includes(normalizedQuery)) {
      score += 12;
    }
    for (const token of tokens) {
      score += occurrences(lowerPath, token) * 7;
      score += Math.min(occurrences(lowerContent, token), 8);
    }
    if (settings.project && lowerPath.includes(project)) {
      score += 8;
    }
    if (score <= 0) {
      continue;
    }
    matches.push({
      path: relative,
      score: score,
      modified: metadata.mtime.toISOString(),
      snippet: bestSnippet(content, tokens)
    });
  }
  matches.sort(function (left, right) {
    return right.score - left.score || right.modified.localeCompare(left.modified);
  });
  return matches.slice(0, limit);
}

export function formatSearchContext(matches) {
  if (!matches || matches.length === 0) {
    return '';
  }
  return matches.map(function (match, index) {
    return '[' + (index + 1) + '] ' + match.path + '\n' + match.snippet;
  }).join('\n\n');
}

async function listSessionFiles() {
  const roots = [path.join(VAULT_ROOT, 'projects'), path.join(VAULT_ROOT, '_inbox', 'auto')];
  const files = [];
  for (const root of roots) {
    await walkMarkdown(root, files);
  }
  const sessionFiles = files.filter(function (file) {
    const relative = path.relative(VAULT_ROOT, file).replace(/\\/g, '/');
    return relative.startsWith('_inbox/auto/') || relative.includes('/sessions/');
  });
  const withStats = [];
  for (const file of sessionFiles) {
    try {
      const metadata = await stat(file);
      withStats.push({ file: file, modified: metadata.mtime });
    } catch {
      continue;
    }
  }
  withStats.sort(function (left, right) {
    return right.modified.getTime() - left.modified.getTime();
  });
  return withStats;
}

export async function refreshRecentIndex() {
  const indexPath = path.join(VAULT_ROOT, '_index.md');
  let index = await readFile(indexPath, 'utf8');
  const sessions = (await listSessionFiles()).slice(0, 20);
  const lines = sessions.length === 0 ? ['아직 기록이 없습니다.'] : sessions.map(function (entry) {
    const relative = path.relative(VAULT_ROOT, entry.file).replace(/\\/g, '/').replace(/\.md$/i, '');
    return '- [[' + relative + ']]';
  });
  const block = '<!-- AUTO-RECENT:START -->\n' + lines.join('\n') + '\n<!-- AUTO-RECENT:END -->';
  index = index.replace(/<!-- AUTO-RECENT:START -->[\s\S]*?<!-- AUTO-RECENT:END -->/, block);
  await writeFile(indexPath, index, 'utf8');
}

function markdownList(values) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  return items.length ? items.map(function (item) {
    return '- ' + String(item).trim();
  }).join('\n') : '- 없음';
}

export async function recordMemory(input) {
  const now = koreanNowParts();
  const project = slugify(input.project || 'general');
  const title = String(input.title || '작업 기록').trim();
  const fileTitle = slugify(title).slice(0, 70) || 'session';
  const relative = 'projects/' + project + '/sessions/' + now.date + '-' + now.compactTime + '-' + fileTitle + '.md';
  const body = [
    '---',
    'created: ' + yamlValue(now.iso),
    'project: ' + yamlValue(project),
    'provider: ' + yamlValue(input.provider || 'llm'),
    'type: session',
    'source: structured-memory',
    '---',
    '',
    '# ' + title,
    '',
    '## 요약',
    '',
    String(input.summary || '요약 없음').trim(),
    '',
    '## 변경 사항',
    '',
    markdownList(input.changes),
    '',
    '## 실행한 명령',
    '',
    markdownList(input.commands),
    '',
    '## 결정',
    '',
    markdownList(input.decisions),
    '',
    '## 다음 작업',
    '',
    markdownList(input.followUps),
    '',
    '## 근거',
    '',
    markdownList(input.sources),
    ''
  ].join('\n');
  const result = await writeVaultFile(relative, body, 'replace');
  const projectIndex = 'projects/' + project + '/README.md';
  if (!await exists(path.join(VAULT_ROOT, projectIndex))) {
    await writeVaultFile(projectIndex, '# ' + project + '\n\n## 최근 작업\n\n- [[' + relative.replace(/\.md$/i, '') + ']]\n', 'replace');
  } else {
    await writeVaultFile(projectIndex, '- [[' + relative.replace(/\.md$/i, '') + ']]', 'append');
  }
  await refreshRecentIndex();
  return result;
}

function cleanCapturedText(value) {
  return String(value || '')
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '[환경 정보 생략]')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '[시스템 안내 생략]')
    .trim()
    .slice(0, MAX_CAPTURE_CHARS);
}

function textFromContent(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(function (item) {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object' && typeof item.text === 'string') {
        return item.text;
      }
      return '';
    }).filter(Boolean).join('\n');
  }
  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return content.text;
  }
  return '';
}

function candidateMessage(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : record;
  const message = payload.message && typeof payload.message === 'object' ? payload.message : payload;
  const rawType = String(message.type || payload.type || record.type || '').toLowerCase();
  let role = String(message.role || payload.role || record.role || '').toLowerCase();
  if (!role && rawType.includes('user')) {
    role = 'user';
  }
  if (!role && rawType.includes('assistant')) {
    role = 'assistant';
  }
  if (role !== 'user' && role !== 'assistant') {
    return null;
  }
  let content = textFromContent(message.content);
  if (!content && typeof message.message === 'string') {
    content = message.message;
  }
  if (!content && typeof payload.message === 'string') {
    content = payload.message;
  }
  if (!content && typeof message.text === 'string') {
    content = message.text;
  }
  if (!content) {
    return null;
  }
  return { role: role, text: cleanCapturedText(content) };
}

async function extractTranscriptMessages(transcriptPath) {
  if (!transcriptPath || !await exists(transcriptPath)) {
    return [];
  }
  let raw;
  try {
    raw = await readFile(transcriptPath, 'utf8');
  } catch {
    return [];
  }
  const lines = raw.split(/\r?\n/).slice(-3000);
  const messages = [];
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    try {
      const record = JSON.parse(line);
      const candidate = candidateMessage(record);
      if (candidate && candidate.text) {
        messages.push(candidate);
      }
    } catch {
      continue;
    }
  }
  return messages;
}

async function readCaptureState() {
  const statePath = path.join(VAULT_ROOT, '.system', 'state', 'captures.json');
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    return { hashes: [] };
  }
}

async function writeCaptureState(state) {
  const statePath = path.join(VAULT_ROOT, '.system', 'state', 'captures.json');
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function captureHookResult(input, provider) {
  if (Array.isArray(input.background_tasks) && input.background_tasks.length > 0) {
    return { captured: false, reason: 'background tasks are still running' };
  }
  const messages = await extractTranscriptMessages(input.transcript_path);
  const lastUser = messages.filter(function (message) {
    return message.role === 'user';
  }).at(-1);
  const lastAssistant = cleanCapturedText(input.last_assistant_message || (messages.filter(function (message) {
    return message.role === 'assistant';
  }).at(-1) || {}).text || '');
  const userText = cleanCapturedText((lastUser || {}).text || input.prompt || '');
  if ((userText + lastAssistant).length < 100) {
    return { captured: false, reason: 'turn was too short' };
  }
  const digest = crypto.createHash('sha256').update(provider + '\n' + userText + '\n' + lastAssistant).digest('hex');
  const state = await readCaptureState();
  if (state.hashes.includes(digest)) {
    return { captured: false, reason: 'duplicate' };
  }
  const now = koreanNowParts();
  const project = projectFromCwd(input.cwd);
  const session = slugify(String(input.session_id || 'session').slice(0, 12));
  const relative = '_inbox/auto/' + now.date + '/' + now.compactTime + '-' + project + '-' + slugify(provider) + '-' + session + '.md';
  const body = [
    '---',
    'created: ' + yamlValue(now.iso),
    'project: ' + yamlValue(project),
    'provider: ' + yamlValue(provider),
    'type: session',
    'source: auto-hook',
    'session_id: ' + yamlValue(input.session_id || ''),
    '---',
    '',
    '# ' + now.date + ' ' + now.time + ' — ' + project,
    '',
    '## 사용자 요청',
    '',
    userText || '추출하지 못함',
    '',
    '## 최종 결과',
    '',
    lastAssistant || '추출하지 못함',
    ''
  ].join('\n');
  const result = await writeVaultFile(relative, body, 'replace');
  state.hashes.push(digest);
  state.hashes = state.hashes.slice(-500);
  await writeCaptureState(state);
  await refreshRecentIndex();
  return { captured: true, path: result.path, redactions: result.redactions };
}

function claudeProjectSlug(directoryName) {
  const markers = ['-Documents-', '-Projects-', '-Desktop-'];
  let name = directoryName;
  for (const marker of markers) {
    const index = directoryName.indexOf(marker);
    if (index >= 0) {
      name = directoryName.slice(index + marker.length);
      break;
    }
  }
  return slugify(name);
}

export async function syncClaudeMemories() {
  let projectDirectories;
  try {
    projectDirectories = await readdir(CLAUDE_PROJECTS_ROOT, { withFileTypes: true });
  } catch {
    return { imported: 0, redactions: 0 };
  }
  let imported = 0;
  let redactions = 0;
  for (const projectDirectory of projectDirectories) {
    if (!projectDirectory.isDirectory()) {
      continue;
    }
    const memoryRoot = path.join(CLAUDE_PROJECTS_ROOT, projectDirectory.name, 'memory');
    let memoryFiles;
    try {
      memoryFiles = await readdir(memoryRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    const project = claudeProjectSlug(projectDirectory.name);
    for (const memoryFile of memoryFiles) {
      if (!memoryFile.isFile() || !memoryFile.name.toLowerCase().endsWith('.md')) {
        continue;
      }
      const sourcePath = path.join(memoryRoot, memoryFile.name);
      let source;
      try {
        source = await readFile(sourcePath, 'utf8');
      } catch {
        continue;
      }
      const sanitized = sanitizeText(source);
      const header = [
        '---',
        'source: claude-auto-memory',
        'project: ' + yamlValue(project),
        'source_file: ' + yamlValue(memoryFile.name),
        '---',
        ''
      ].join('\n');
      const relative = 'imports/claude/' + project + '/' + slugify(path.basename(memoryFile.name, '.md')) + '.md';
      const target = safeRelativePath(relative).target;
      const output = header + sanitized.text.replace(/^---[\s\S]*?---\s*/m, '');
      let current = '';
      try {
        current = await readFile(target, 'utf8');
      } catch {
        current = '';
      }
      if (current !== output) {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, output, 'utf8');
        imported += 1;
      }
      redactions += sanitized.redactions;
    }
  }
  return { imported: imported, redactions: redactions };
}

export async function projectStartupContext(cwd) {
  const project = projectFromCwd(cwd);
  const pieces = [];
  const index = await readFile(path.join(VAULT_ROOT, '_index.md'), 'utf8');
  pieces.push('AI-Memory project: ' + project);
  pieces.push('Required workflow: search memory before relying on prior project/server history; record durable results after meaningful work; never store secrets.');
  pieces.push(index.slice(0, 3500));
  for (const name of ['current-state.md', 'runbook.md', 'decisions.md', 'incidents.md']) {
    const target = path.join(VAULT_ROOT, 'projects', project, name);
    if (await exists(target)) {
      const content = await readFile(target, 'utf8');
      pieces.push('## ' + project + '/' + name + '\n' + content.slice(0, 2500));
    }
  }
  if (pieces.length <= 3) {
    const matches = await searchMemory(project, { project: project, limit: 4 });
    if (matches.length) {
      pieces.push('## Related existing memory\n' + formatSearchContext(matches));
    }
  }
  return pieces.join('\n\n').slice(0, 9500);
}

export async function promptSearchContext(prompt, cwd) {
  const project = projectFromCwd(cwd);
  const matches = await searchMemory(prompt, { project: project, limit: 5 });
  if (!matches.length) {
    return '';
  }
  return [
    'AI-Memory found potentially relevant prior context.',
    'Treat it as historical context and verify live state when necessary.',
    formatSearchContext(matches)
  ].join('\n\n').slice(0, 9000);
}

export async function memoryStatus() {
  const files = [];
  await walkMarkdown(VAULT_ROOT, files);
  const imports = files.filter(function (file) {
    return file.includes(path.join('imports', 'claude'));
  }).length;
  return {
    vault: VAULT_ROOT,
    markdownFiles: files.length,
    importedClaudeMemories: imports,
    project: projectFromCwd(process.cwd()),
    safety: 'Secret-like values are redacted on writes and automatic imports.'
  };
}

export async function autoCommitVault(message) {
  if (!await exists(path.join(VAULT_ROOT, '.git'))) {
    return { committed: false, reason: 'git repository is not initialized' };
  }
  const gitArgs = ['-C', VAULT_ROOT, '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null'];
  try {
    await execFileAsync('git', gitArgs.concat(['add', '-A']), { timeout: 10000 });
    try {
      await execFileAsync('git', gitArgs.concat(['diff', '--cached', '--quiet']), { timeout: 10000 });
      return { committed: false, reason: 'no changes' };
    } catch (difference) {
      if (difference.code !== 1) {
        throw difference;
      }
    }
    const commit = await execFileAsync(
      'git',
      gitArgs.concat(['commit', '-m', sanitizeText(message || 'AI memory update').text]),
      { timeout: 10000 }
    );
    return { committed: true, output: String(commit.stdout || '').trim() };
  } catch (error) {
    return { committed: false, reason: error.message || String(error) };
  }
}

export async function logHookError(error) {
  const logPath = path.join(VAULT_ROOT, '.system', 'logs', 'hook-errors.log');
  await mkdir(path.dirname(logPath), { recursive: true });
  const now = koreanNowParts();
  await appendFile(logPath, now.iso + ' ' + (error && error.stack ? error.stack : String(error)) + '\n', 'utf8');
}
