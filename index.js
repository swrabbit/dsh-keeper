/**
 * DSH Keeper — host half.
 *
 * Serves the panel's data API and performs the destructive Work (moving a
 * session log into the plugin's own trash, restoring it, purging it) against
 * the DSH host services instead of touching the registry behind its back.
 *
 * The client half renders three slots: the sidebar panel launcher, the main
 * management panel, and a Settings→Plugins page.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

export const name = 'dsh-keeper';

/** Host services this plugin composes. */
export const inject = [
  'webServer',
  'connection',
  'sessionPersistence',
  'workspaceRegistry',
  'sessionController',
];

const NS = 'dsh-keeper';
const PANEL_ID = 'dsh-keeper';
const API_PATH = '/dsh-keeper/api';
const PLUGIN_VERSION = '0.1.6';
const META_NAME = '.dsh-keeper-trash.json';
/** Pre-rename identifiers. Kept only so existing installs migrate in place. */
const LEGACY_NS = 'sidebar-studio';
const LEGACY_META_NAME = '.sidebar-studio-trash.json';
const LEGACY_BUNDLE = 'dsh-sidebar-studio';
/** Bundle names the keeper may be installed under; every self-protection check must recognize all of them. */
const SELF_BUNDLES = new Set(['dsh-keeper', 'dsh-keeper-plugin', LEGACY_BUNDLE]);

function isSelfEntryId(value) {
  return typeof value === 'string' && (value.indexOf('dsh-keeper') !== -1 || value.indexOf(LEGACY_BUNDLE) !== -1);
}

const SOUND_KINDS = ['normal', 'interrupt'];
const SOUND_MIME = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };
const SOUND_MAX_BYTES = 2 * 1024 * 1024;

const NOTIFY_DEFAULTS = {
  enabled: true,
  onDone: true,
  onError: true,
  onAsk: true,
  system: true,
  inApp: true,
  unfocusedOnly: true,
  // `sound` is the on/off audio channel: 'none' mutes the tones, everything
  // else keeps them on. `sounds` carries the per-group file names.
  sound: 'system',
  // The master switch is derived from the two channels; this remembers the last
  // non-empty combination so turning it back on restores what the user had.
  lastChannels: { banner: true, sound: true },
  volume: 100,
  sounds: { normal: { name: '' }, interrupt: { name: '' } },
  openOnClick: true,
  // Quiet hours (DND): within the local-time window banners and tones are
  // held back, but the notification center still records the entry.
  quiet: { enabled: false, start: '22:00', end: '08:00' },
  // Mute completion reminders only; failures and pending questions still pass.
  muteDone: false,
  // Workspace ids whose notifications are held back (history unaffected).
  mutedWorkspaces: [],
};

const DEFAULT_SETTINGS = {
  deleteMode: 'trash',
  confirmPurge: true,
  defaultExportFormat: 'md',
  notifications: { ...NOTIFY_DEFAULTS },
};

function normalizeSoundEntry(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return { name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : '' };
}

function normalizeNotifyLastChannels(value, fallback) {
  const raw = value && typeof value === 'object' ? value : null;
  const banner = raw ? raw.banner !== false : fallback.banner;
  const sound = raw ? raw.sound !== false : fallback.sound;
  if (banner || sound) return { banner, sound };
  if (fallback.banner || fallback.sound) return { banner: fallback.banner, sound: fallback.sound };
  return { banner: true, sound: true };
}

function normalizeClock(value, fallback) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(typeof value === 'string' ? value.trim() : '');
  return match ? `${match[1]}:${match[2]}` : fallback;
}

function normalizeNotificationSettings(value) {
  const raw = value && typeof value === 'object' ? value : {};
  // Older builds stored 'custom'; that synthetic tone is now the built-in
  // default, so only 'none' still means silent.
  const sound = raw.sound === 'none' ? 'none' : 'system';
  const rawBanner = raw.system !== false;
  const rawSoundOn = sound !== 'none';
  const lastChannels = normalizeNotifyLastChannels(raw.lastChannels, {
    banner: rawBanner,
    sound: rawSoundOn,
  });
  // The master switch aggregates the two channels: muting it clears both, and
  // turning the last channel off flips it off, so the persisted state can never
  // claim "enabled" while every channel is silent.
  const enabled = raw.enabled !== false;
  const banner = enabled && rawBanner;
  const soundOn = enabled && rawSoundOn;
  const volume = Number(raw.volume);
  const rawSounds = raw.sounds && typeof raw.sounds === 'object' ? raw.sounds : {};
  const sounds = {};
  for (const kind of SOUND_KINDS) sounds[kind] = normalizeSoundEntry(rawSounds[kind]);
  return {
    enabled: banner || soundOn,
    onDone: raw.onDone !== false,
    onError: raw.onError !== false,
    onAsk: raw.onAsk !== false,
    system: banner,
    // The "提醒方式" card was folded into the banner switch: an in-app toast
    // is only a fallback and banners stay background-only, so both are fixed on.
    inApp: true,
    unfocusedOnly: true,
    sound: soundOn ? 'system' : 'none',
    lastChannels,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : 100,
    sounds,
    quiet: {
      enabled: raw.quiet?.enabled === true,
      start: normalizeClock(raw.quiet?.start, '22:00'),
      end: normalizeClock(raw.quiet?.end, '08:00'),
    },
    muteDone: raw.muteDone === true,
    mutedWorkspaces: Array.isArray(raw.mutedWorkspaces)
      ? raw.mutedWorkspaces.filter((id) => typeof id === 'string' && id).slice(0, 100)
      : [],
    openOnClick: raw.openOnClick !== false,
  };
}

const DEFAULT_STATE = {
  version: 1,
  hiddenPanels: [],
  settings: { ...DEFAULT_SETTINGS },
  updatedAt: 0,
};

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const infoCache = new Map();

/* ------------------------------------------------------------------ paths */

function dshHome() {
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv;
  return path.join(os.homedir(), '.dsh');
}

function storagesDir() {
  return path.join(dshHome(), 'storages');
}

function dataDir() {
  return path.join(storagesDir(), NS);
}

function legacyDataDir() {
  return path.join(storagesDir(), LEGACY_NS);
}

function copyMissingTree(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copyMissingTree(path.join(from, name), path.join(to, name));
    return;
  }
  if (!fs.existsSync(to)) fs.copyFileSync(from, to);
}

/**
 * Move an old `storages/sidebar-studio` tree into the new data directory without
 * overwriting anything the user already created under the new name. The old
 * directory is left in place as a one-version rollback.
 */
const MIGRATION_MARKER = '.dsh-keeper-migrated';

function migrateLegacyData() {
  const target = dataDir();
  const legacy = legacyDataDir();
  if (path.resolve(target) === path.resolve(legacy)) return false;
  try {
    if (!fs.existsSync(legacy)) return false;
    if (fs.existsSync(path.join(target, MIGRATION_MARKER))) return false;
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(legacy)) {
      copyMissingTree(path.join(legacy, name), path.join(target, name));
    }
    fs.writeFileSync(path.join(target, MIGRATION_MARKER), `${new Date().toISOString()}\n`, 'utf8');
    return true;
  } catch (error) {
    console.warn('[dsh-keeper] legacy data migration failed:', error?.message ?? error);
    return false;
  }
}

function stateFile() {
  return path.join(dataDir(), 'state.json');
}

function trashRoot() {
  return path.join(dataDir(), 'trash');
}

function soundsDir() {
  return path.join(dataDir(), 'sounds');
}

function workspaceFile() {
  return path.join(storagesDir(), 'workspace.json');
}

function sessionsRoot() {
  return path.join(dshHome(), 'sessions');
}

/* ------------------------------------------------------ profile patch layer */

function profileDir() {
  const fromEnv = process.env.DSH_PROFILE_DIR;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv;
  return path.join(dshHome(), 'profiles', 'desktop');
}

function profilePatchFile() {
  return path.join(profileDir(), 'cordis.patch.yml');
}

const PATCH_BLOCK_START = /^\s*-\s/;
const PATCH_BLOCK_ID = /^\s*-?\s*id:\s*["']?([^"'\s#]+)/;
const PATCH_BLOCK_NAME = /^\s*name:\s*["']?([^"'\s#]+)/;
const PATCH_BLOCK_DISABLED = /^\s*disabled:\s*true\s*$/m;

/**
 * Rows this profile disables through a patch override (`- id: <x>` plus only
 * `disabled: true`). The Loader drops those rows from its live entry list, so
 * `pluginManager.listPlugins()` can neither show nor re-enable them any more;
 * the profile patch layer is the only surviving record.
 */
function readDisabledPatches() {
  let text = '';
  try {
    text = fs.readFileSync(profilePatchFile(), 'utf8');
  } catch {
    return [];
  }
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (PATCH_BLOCK_START.test(line) || line.trim() === '-') {
      if (current) blocks.push(current);
      current = { lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  const rows = [];
  for (const block of blocks) {
    const body = block.lines.join('\n');
    if (!PATCH_BLOCK_DISABLED.test(body)) continue;
    const idMatch = block.lines.map((line) => line.match(PATCH_BLOCK_ID)).find(Boolean);
    if (!idMatch) continue;
    const keys = block.lines
      .map((line) => line.match(/^\s{2,}([A-Za-z_][\w-]*):/))
      .filter(Boolean)
      .map((match) => match[1]);
    if (keys.some((key) => key !== 'id' && key !== 'name' && key !== 'disabled')) continue;
    const nameMatch = block.lines.map((line) => line.match(PATCH_BLOCK_NAME)).find(Boolean);
    rows.push({ id: idMatch[1], name: nameMatch ? nameMatch[1] : null });
  }
  return rows;
}

/** Remove one pure `- id / disabled: true` override so the Loader mounts it again. */
function enableDisabledPatch(patchId) {
  let text = '';
  try {
    text = fs.readFileSync(profilePatchFile(), 'utf8');
  } catch {
    return false;
  }
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(PATCH_BLOCK_ID);
    if (!match || match[1] !== patchId) continue;
    if (!(PATCH_BLOCK_START.test(lines[index]) || lines[index].trim() === '-')) continue;
    start = index;
    break;
  }
  if (start === -1) return false;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (PATCH_BLOCK_START.test(lines[index]) || lines[index].trim() === '-') {
      end = index;
      break;
    }
  }
  if (end >= lines.length) end = lines.length;
  while (end < lines.length && lines[end].trim() === '') end += 1;
  const blockText = lines.slice(start, end).join('\n');
  if (!PATCH_BLOCK_DISABLED.test(blockText)) return false;
  lines.splice(start, end - start);
  const next = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')}\n`;
  try {
    fs.writeFileSync(profilePatchFile(), next, 'utf8');
  } catch {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------- json */

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/* ------------------------------------------------------------------ state */

function readState() {
  const raw = readJson(stateFile(), null);
  const state = raw && typeof raw === 'object' ? raw : {};
  const settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
  const hidden = Array.isArray(state.hiddenPanels)
    ? state.hiddenPanels.filter((id) => typeof id === 'string' && id.length > 0 && id.length < 200)
    : [];
  return {
    version: 1,
    hiddenPanels: [...new Set(hidden)],
    settings: {
      deleteMode: settings.deleteMode === 'delete' ? 'delete' : 'trash',
      confirmPurge: settings.confirmPurge !== false,
      defaultExportFormat: normalizeExportFormat(settings.defaultExportFormat),
      notifications: normalizeNotificationSettings(settings.notifications),
    },
    updatedAt: typeof state.updatedAt === 'number' ? state.updatedAt : 0,
  };
}

function writeState(state) {
  const next = {
    version: 1,
    hiddenPanels: [...new Set(state.hiddenPanels ?? [])],
    settings: {
      deleteMode: state.settings?.deleteMode === 'delete' ? 'delete' : 'trash',
      confirmPurge: state.settings?.confirmPurge !== false,
      defaultExportFormat: normalizeExportFormat(state.settings?.defaultExportFormat),
      notifications: normalizeNotificationSettings(state.settings?.notifications),
    },
    updatedAt: Date.now(),
  };
  writeJson(stateFile(), next);
  return next;
}

function readRegistryState() {
  const raw = readJson(workspaceFile(), null);
  const global = raw && raw.global && typeof raw.global === 'object' ? raw.global : {};
  const toSet = (value) =>
    new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
  return {
    archived: toSet(global.archivedSessionIds),
    pinned: toSet(global.pinnedSessionIds),
  };
}

/* --------------------------------------------------------------- sessions */

function assertSessionId(id) {
  if (typeof id !== 'string' || !/^session-[A-Za-z0-9_-]{1,120}$/.test(id)) {
    throw fail('BAD_SESSION_ID', `Invalid session id: ${String(id)}`);
  }
  return id;
}

function listSessionDirs() {
  const root = sessionsRoot();
  const out = [];
  let groups = [];
  try {
    groups = fs.readdirSync(root);
  } catch {
    return out;
  }
  for (const group of groups) {
    const groupPath = path.join(root, group);
    let groupStat;
    try {
      groupStat = fs.statSync(groupPath);
    } catch {
      continue;
    }
    if (!groupStat.isDirectory()) continue;
    let names = [];
    try {
      names = fs.readdirSync(groupPath);
    } catch {
      continue;
    }
    for (const entry of names) {
      if (!entry.startsWith('session-')) continue;
      const dir = path.join(groupPath, entry);
      let stat;
      try {
        stat = fs.statSync(dir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      out.push({ id: entry, dir, group, mtimeMs: stat.mtimeMs });
    }
  }
  return out;
}

function sessionLogFile(dir) {
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const log = names.find((n) => n.endsWith('.jsonl.zstd')) ?? names.find((n) => n.endsWith('.jsonl'));
  return log ? path.join(dir, log) : null;
}

function dirSize(dir) {
  let total = 0;
  let names = [];
  try {
    names = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of names) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += dirSize(full);
      else total += fs.statSync(full).size;
    } catch {
      /* skip unreadable entries */
    }
  }
  return total;
}

function hasZstd() {
  return typeof zlib.zstdDecompressSync === 'function';
}

function decodeZstdLog(file) {
  const buffer = fs.readFileSync(file);
  const chunks = [];
  let index = buffer.indexOf(ZSTD_MAGIC);
  while (index !== -1) {
    try {
      chunks.push(zlib.zstdDecompressSync(buffer.subarray(index)));
    } catch {
      /* not a frame start; ignore */
    }
    index = buffer.indexOf(ZSTD_MAGIC, index + 4);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  const events = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') events.push(parsed);
    } catch {
      /* partial line in a frame boundary; ignore */
    }
  }
  return { text, events };
}

async function readEventsViaPersistence(ctx, id) {
  let handle;
  try {
    handle = await ctx.sessionPersistence.open(id, 'read');
  } catch {
    return [];
  }
  try {
    const result = await handle.read();
    return Array.isArray(result?.events) ? result.events : [];
  } catch {
    return [];
  } finally {
    try {
      await handle.close();
    } catch {
      /* ignore */
    }
  }
}

function messageText(data) {
  const direct = contentTextOf(data?.content);
  if (direct) return direct;
  // Assistant events keep the model message under `data.message`.
  const nested = contentTextOf(data?.message?.content);
  if (nested) return nested;
  if (typeof data?.text === 'string' && data.text.trim()) return data.text.trim();
  return '';
}

function truncate(text, max) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Toast bodies are plain text: strip the Markdown the model writes so that
 * `**bold**` / `` `code` `` never leak into a Windows notification.
 */
function stripMarkdown(text) {
  return String(text ?? '')
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, ' $1 ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+/gm, '')
    .replace(/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+)_(?![\w])/g, '$1$2')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/\|/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

function deriveFromEvents(events, fallbackTitle) {
  let title = '';
  let firstUser = '';
  let messages = 0;
  let lastTime = 0;
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    if (typeof event.time === 'number' && event.time > lastTime) lastTime = event.time;
    if (event.type === 'session/title' && typeof event.data?.title === 'string') {
      const candidate = event.data.title.trim();
      if (candidate) title = candidate;
    }
    if (event.type === 'user/message') {
      messages += 1;
      if (!firstUser) firstUser = messageText(event.data);
    } else if (event.type === 'assistant/message') {
      messages += 1;
    }
  }
  return {
    title: title || truncate(firstUser, 80) || truncate(fallbackTitle ?? '', 80) || '',
    messageCount: messages,
    lastTime,
  };
}

async function sessionInfo(ctx, id, snapshot, dirMap, runningSet, registry) {
  const found = dirMap.get(id);
  const dir = found?.dir ?? null;
  const logFile = dir ? sessionLogFile(dir) : null;
  let sizeBytes = snapshot?.sizeBytes;
  if (typeof sizeBytes !== 'number') {
    try {
      sizeBytes = logFile ? fs.statSync(logFile).size : dirSize(dir ?? '');
    } catch {
      sizeBytes = 0;
    }
  }
  const revision = snapshot?.revision;
  const cached = infoCache.get(id);
  let base;
  if (cached && cached.revision === revision && cached.sizeBytes === sizeBytes && cached.dir === dir) {
    base = cached.info;
  } else {
    let events = [];
    let text = '';
    if (logFile && hasZstd()) {
      try {
        const decoded = decodeZstdLog(logFile);
        events = decoded.events;
        text = decoded.text;
      } catch {
        events = [];
      }
    }
    if (events.length === 0) {
      events = await readEventsViaPersistence(ctx, id);
    }
    const derived = deriveFromEvents(events, '');
    const createdAt = snapshot?.header?.createdAt;
    base = {
      id,
      title: derived.title || snapshot?.header?.id || id,
      sizeBytes,
      eventCount: events.length > 0 ? events.length : snapshot?.eventCount ?? 0,
      messageCount: derived.messageCount,
      blank: derived.messageCount === 0,
      createdAt: typeof createdAt === 'number' ? createdAt : (dir ? safeMtime(logFile) : Date.now()),
      updatedAt: derived.lastTime || safeMtime(logFile) || Date.now(),
      formatStatus: snapshot?.formatStatus ?? 'current',
      missingLog: !logFile,
      hasTitle: Boolean(derived.title),
      _textLength: text.length,
    };
    infoCache.set(id, { revision, sizeBytes, dir, info: base });
  }
  return {
    ...base,
    running: runningSet.has(id),
    archived: registry.archived.has(id),
    pinned: registry.pinned.has(id),
    origin: typeof snapshot?.header?.origin === 'string' ? snapshot.header.origin : '',
    parentSession: typeof snapshot?.header?.parentSession === 'string' ? snapshot.header.parentSession : '',
  };
}

function safeMtime(file) {
  try {
    return file ? Math.round(fs.statSync(file).mtimeMs) : 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ trash */

function sanitizeTrashId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    throw fail('BAD_TRASH_ID', `Invalid trash id: ${String(id)}`);
  }
  return id;
}

function trashDirOf(trashId) {
  return path.join(trashRoot(), sanitizeTrashId(trashId));
}

function readTrash() {
  const root = trashRoot();
  let names = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  const entries = [];
  for (const name of names) {
    const dir = path.join(root, name);
    let stat;
    try {
      stat = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const meta = readJson(path.join(dir, META_NAME), null) ?? readJson(path.join(dir, LEGACY_META_NAME), null);
    if (!meta || typeof meta !== 'object' || typeof meta.sessionId !== 'string') continue;
    entries.push({
      trashId: name,
      sessionId: meta.sessionId,
      title: typeof meta.title === 'string' && meta.title ? meta.title : meta.sessionId,
      workspaceId: typeof meta.workspaceId === 'string' ? meta.workspaceId : null,
      workspaceTitle: typeof meta.workspaceTitle === 'string' ? meta.workspaceTitle : '',
      workspacePath: typeof meta.workspacePath === 'string' ? meta.workspacePath : '',
      deletedAt: typeof meta.deletedAt === 'number' ? meta.deletedAt : Math.round(stat.mtimeMs),
      sizeBytes: dirSize(dir),
      wasArchived: meta.wasArchived === true,
    });
  }
  entries.sort((a, b) => b.deletedAt - a.deletedAt);
  return entries;
}

/* --------------------------------------------------------------- registry */

function workspaceContaining(ctx, sessionId) {
  try {
    return ctx.workspaceRegistry.list().find((workspace) => workspace.sessionIds.includes(sessionId)) ?? null;
  } catch {
    return null;
  }
}

async function detachSession(ctx, sessionId) {
  const workspace = workspaceContaining(ctx, sessionId);
  if (!workspace) return null;
  try {
    await workspace.detachSession(sessionId);
    return workspace.id;
  } catch {
    return null;
  }
}

async function attachSession(ctx, sessionId, workspaceId, workspacePath, workspaceTitle) {
  let workspace = null;
  try {
    if (workspaceId) workspace = ctx.workspaceRegistry.get(workspaceId) ?? null;
  } catch {
    workspace = null;
  }
  if (!workspace && workspacePath) {
    try {
      workspace = ctx.workspaceRegistry.resolveByPath(workspacePath) ?? null;
    } catch {
      workspace = null;
    }
  }
  if (!workspace && workspacePath) {
    try {
      workspace = ctx.workspaceRegistry.create(workspacePath, workspaceTitle || undefined);
    } catch {
      workspace = null;
    }
  }
  if (!workspace) throw fail('WORKSPACE_MISSING', '会话所属工作区已不存在，无法恢复。');
  await workspace.attachSession(sessionId);
  return workspace.id;
}

/* -------------------------------------------------------------- API types */

async function runningSet(ctx) {
  const set = new Set();
  try {
    const result = await ctx.sessionController.list({}, new AbortController().signal);
    const items = Array.isArray(result?.items) ? result.items : [];
    for (const item of items) {
      if (item && item.running === true && typeof item.sessionId === 'string') set.add(item.sessionId);
    }
  } catch {
    /* running detection is best effort */
  }
  return set;
}

async function buildBootstrap(ctx) {
  const state = readState();
  const registry = readRegistryState();
  const running = await runningSet(ctx);

  let snapshots = [];
  try {
    snapshots = await ctx.sessionPersistence.list();
  } catch {
    snapshots = [];
  }
  const snapshotMap = new Map();
  for (const snapshot of snapshots) {
    if (snapshot?.header?.id) snapshotMap.set(snapshot.header.id, snapshot);
  }

  const dirMap = new Map(listSessionDirs().map((entry) => [entry.id, entry]));

  let registryWorkspaces = [];
  try {
    registryWorkspaces = ctx.workspaceRegistry.list();
  } catch {
    registryWorkspaces = [];
  }

  const cache = new Map();
  const workspaces = [];
  for (const workspace of registryWorkspaces) {
    const sessions = [];
    for (const id of workspace.sessionIds) {
      let info = cache.get(id);
      if (!info) {
        info = await sessionInfo(ctx, id, snapshotMap.get(id), dirMap, running, registry);
        cache.set(id, info);
      }
      sessions.push(info);
    }
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    workspaces.push({
      id: workspace.id,
      title: workspace.title,
      path: workspace.path,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      sessions,
    });
  }

  return {
    version: PLUGIN_VERSION,
    panelId: PANEL_ID,
    state,
    workspaces,
    trash: readTrash(),
    canOpenPath: canOpenWorkspacePath(ctx),
    exportFormats: EXPORT_FORMATS,
    paths: { sessionsRoot: sessionsRoot(), dataDir: dataDir(), trashDir: trashRoot() },
  };
}

/** Whether this deployment can hand a workspace folder to the native desktop. */
function canOpenWorkspacePath(ctx) {
  const controller = ctx.sessionController;
  if (!controller || typeof controller.openWorkspacePath !== 'function') return false;
  if (typeof controller.canOpenWorkspacePath !== 'function') return true;
  try {
    return controller.canOpenWorkspacePath() === true;
  } catch {
    return false;
  }
}

/** Open one workspace folder in the Host desktop file manager. */
async function openWorkspacePath(ctx, payload) {
  const raw = typeof payload?.path === 'string' ? payload.path.trim() : '';
  if (!raw) throw fail('BAD_PATH', '缺少工作区路径。');
  const controller = ctx.sessionController;
  if (!controller || typeof controller.openWorkspacePath !== 'function') {
    throw fail('UNSUPPORTED', '当前环境不支持打开本地路径。');
  }
  const value = await controller.openWorkspacePath({ path: raw }, AbortSignal.timeout(15000));
  return { opened: value?.opened === true, path: raw };
}

/** Enable or disable one Loader entry through the profile plugin manager. */
async function setPluginEnabled(ctx, payload) {
  const manager = typeof ctx.get === 'function' ? ctx.get('pluginManager') : undefined;
  if (!manager || typeof manager.setPluginEnabled !== 'function') {
    throw fail('UNSUPPORTED', '当前环境不支持启用/禁用插件。');
  }
  const entryId = typeof payload?.entryId === 'string' ? payload.entryId : '';
  if (!entryId) throw fail('BAD_ENTRY_ID', '缺少插件入口 id。');
  if (isSelfEntryId(entryId)) throw fail('PROTECTED', 'DSH 管家自身不能被禁用。');
  const enabled = payload?.enabled === true;
  const result = await manager.setPluginEnabled(entryId, enabled);
  inventoryCache.at = 0;
  scopeCache.at = 0;
  return {
    changed: result?.changed === true,
    enabled,
    application: typeof result?.application === 'string' ? result.application : null,
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    error: result?.error ?? null,
  };
}

/** Uninstall one profile-owned bundle through the profile plugin manager. */
async function uninstallPlugin(ctx, payload) {
  const manager = typeof ctx.get === 'function' ? ctx.get('pluginManager') : undefined;
  if (!manager || typeof manager.removeBundle !== 'function') {
    throw fail('UNSUPPORTED', '当前环境不支持卸载插件。');
  }
  const name = typeof payload?.bundle === 'string' ? payload.bundle.trim() : '';
  if (!name) throw fail('BAD_BUNDLE', '缺少插件包名。');
  if (payload?.confirm !== true) throw fail('CONFIRM_REQUIRED', '卸载操作需要二次确认。');
  if (SELF_BUNDLES.has(name)) throw fail('PROTECTED', '不能卸载 DSH 管家自身。');
  let bundle = null;
  try {
    const bundles = await manager.listBundles();
    bundle = (Array.isArray(bundles) ? bundles : []).find((entry) => entry && entry.name === name) ?? null;
  } catch {
    bundle = null;
  }
  if (!bundle) throw fail('NOT_FOUND', '找不到该插件包。');
  if (bundle.removable !== true) throw fail('NOT_REMOVABLE', '该插件不能被卸载。');
  const result = await manager.removeBundle(name);
  inventoryCache.at = 0;
  scopeCache.at = 0;
  return {
    changed: result?.changed === true,
    application: typeof result?.application === 'string' ? result.application : null,
    bundle: name,
    version: typeof bundle.version === 'string' ? bundle.version : null,
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    error: result?.error ?? null,
  };
}

/**
 * Re-enable a row this profile disabled through a pure patch override. The
 * Loader drops disabled rows from listPlugins(), so pluginManager has no row to
 * address any more; removing our own `disabled: true` override is the only
 * recovery path, and the Loader only reads the patch at startup.
 */
async function enablePluginOverride(ctx, payload) {
  const patchId = typeof payload?.patchId === 'string' ? payload.patchId.trim() : '';
  if (!patchId) throw fail('BAD_PATCH_ID', '缺少需要恢复的插件行 id。');
  if (isSelfEntryId(patchId)) throw fail('PROTECTED', 'DSH 管家自身不能被修改。');
  const known = readDisabledPatches().some((row) => row.id === patchId);
  if (!known) throw fail('NOT_FOUND', '找不到该插件的禁用记录，请在「设置 → 插件」中手动启用。');
  if (!enableDisabledPatch(patchId)) throw fail('WRITE_FAILED', '无法更新 profile 补丁文件，请手动启用该插件。');
  inventoryCache.at = 0;
  scopeCache.at = 0;
  return { changed: true, patchId, application: 'restart-required' };
}

/* ------------------------------------------------------------ translation */

const TRANSLATIONS_FILE = 'translations.json';
const TRANSLATION_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const TRANSLATION_MAX_ENTRIES = 400;

function translationsFile() {
  return path.join(dataDir(), TRANSLATIONS_FILE);
}

let translationCache = null;

function readTranslations() {
  if (translationCache) return translationCache;
  const raw = readJson(translationsFile(), null);
  const entries = raw && typeof raw === 'object' && raw.entries && typeof raw.entries === 'object' ? raw.entries : {};
  translationCache = entries;
  return translationCache;
}

function writeTranslations(map) {
  try {
    const keys = Object.keys(map);
    let next = map;
    if (keys.length > TRANSLATION_MAX_ENTRIES) {
      keys.sort((a, b) => (map[b]?.at ?? 0) - (map[a]?.at ?? 0));
      next = {};
      for (const key of keys.slice(0, TRANSLATION_MAX_ENTRIES)) next[key] = map[key];
    }
    translationCache = next;
    writeJson(translationsFile(), { version: 1, entries: next });
  } catch {
    /* the translation cache is best effort */
  }
}

/** Translate one short English text into Simplified Chinese with the Host model. */
async function translateWithLlm(llm, text) {
  const providers = typeof llm.listProviders === 'function' ? llm.listProviders() : [];
  const order = [];
  for (const provider of Array.isArray(providers) ? providers : []) {
    const id = typeof provider === 'string' ? provider : provider && provider.id;
    if (typeof id === 'string' && id && !order.includes(id)) order.push(id);
  }
  order.sort((a, b) => Number(b.includes('deepseek')) - Number(a.includes('deepseek')));
  for (const providerId of order) {
    let model = null;
    try {
      const models = await llm.listModels(providerId);
      const list = (Array.isArray(models) ? models : []).filter((entry) => entry && typeof entry.id === 'string' && entry.id);
      model = list.find((entry) => /chat|flash|pro|v\d/i.test(entry.id)) || list[0] || null;
    } catch {
      model = null;
    }
    if (!model) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let out = '';
    try {
      const stream = llm.stream({
        provider: providerId,
        model: model.id,
        system:
          '你是一名专业的技术翻译。把用户给出的英文软件或插件描述翻译成简体中文，只输出译文本身，保留产品名与专有名词，不添加解释。',
        messages: [{ role: 'user', content: [{ type: 'text', text }] }],
        temperature: 0.2,
        maxTokens: 600,
        signal: controller.signal,
      });
      for await (const chunk of stream) {
        if (!chunk || typeof chunk !== 'object') continue;
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
          out += chunk.text;
          if (out.length > 4000) break;
        }
        if (chunk.type === 'finish' && chunk.reason && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) break;
      }
    } catch {
      /* try the next provider route */
    } finally {
      clearTimeout(timer);
    }
    const trimmed = out.trim().replace(/\s+/g, ' ');
    if (trimmed) return trimmed;
  }
  throw fail('TRANSLATE_FAILED', '翻译失败，请稍后重试。');
}

/** Translate plugin description text to Simplified Chinese, with a local cache. */
async function translateText(ctx, payload) {
  const raw = typeof payload?.text === 'string' ? payload.text.trim() : '';
  if (!raw) throw fail('BAD_TEXT', '缺少需要翻译的文本。');
  const text = raw.slice(0, 2000);
  const key = crypto.createHash('sha1').update(text).digest('hex');
  const cache = readTranslations();
  const cached = cache[key];
  if (cached && typeof cached.text === 'string' && cached.text && Date.now() - (cached.at ?? 0) < TRANSLATION_TTL_MS) {
    return { text: cached.text, cached: true };
  }
  const llm = typeof ctx.get === 'function' ? ctx.get('llm') : undefined;
  if (!llm || typeof llm.stream !== 'function' || typeof llm.listProviders !== 'function' || typeof llm.listModels !== 'function') {
    throw fail('UNSUPPORTED', '当前环境不支持模型翻译。');
  }
  const translated = await translateWithLlm(llm, text);
  cache[key] = { text: translated, at: Date.now() };
  writeTranslations(cache);
  return { text: translated, cached: false };
}

/** Drop every cached plugin-description translation. */
function clearTranslationCache() {
  translationCache = {};
  try {
    fs.rmSync(translationsFile(), { force: true });
  } catch {
    /* removing the file is best effort: the in-memory cache is already empty */
  }
  return { cleared: true };
}

/* --------------------------------------------------------------- mutations */

function moveToTrash(sessionId, dir, meta) {
  const trashId = `${Date.now().toString(36)}-${sessionId.replace(/^session-/, '')}`;
  const target = path.join(trashRoot(), trashId);
  fs.mkdirSync(trashRoot(), { recursive: true });
  if (fs.existsSync(target)) throw fail('TRASH_CONFLICT', '回收站条目重名，请重试。');
  let moved = false;
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      fs.renameSync(dir, target);
      moved = true;
      break;
    } catch (error) {
      lastError = error;
      const transient = error?.code === 'EBUSY' || error?.code === 'EPERM' || error?.code === 'EACCES';
      if (!transient) break;
      const until = Date.now() + 200 * (attempt + 1);
      while (Date.now() < until) {
        /* brief synchronous backoff; the API is a short request */
      }
    }
  }
  if (!moved) {
    throw fail(
      'SESSION_BUSY',
      `无法移动会话日志（${lastError?.code ?? 'UNKNOWN'}），它可能仍被当前进程占用，请稍后重试。`,
    );
  }
  try {
    writeJson(path.join(target, META_NAME), { ...meta, sessionId, deletedAt: Date.now(), trashId });
  } catch (error) {
    try {
      fs.renameSync(target, dir);
    } catch {
      /* best effort rollback */
    }
    throw fail('TRASH_WRITE_FAILED', `无法写入回收站元数据：${error?.message ?? error}`);
  }
  return { trashId, target };
}

async function deleteSessions(ctx, payload) {
  const mode = payload?.mode === 'archive' ? 'archive' : 'trash';
  const sessionIds = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];
  if (sessionIds.length === 0) throw fail('BAD_REQUEST', '没有选择会话。');
  if (sessionIds.length > 100) throw fail('BAD_REQUEST', '一次最多处理 100 个会话。');
  const running = await runningSet(ctx);
  const registry = readRegistryState();
  const dirMap = new Map(listSessionDirs().map((entry) => [entry.id, entry]));

  const done = [];
  const errors = [];
  for (const rawId of sessionIds) {
    let id;
    try {
      id = assertSessionId(rawId);
    } catch (error) {
      errors.push({ sessionId: String(rawId), code: error.code ?? 'BAD_SESSION_ID', message: error.message });
      continue;
    }
    if (running.has(id)) {
      errors.push({ sessionId: id, code: 'SESSION_RUNNING', message: '会话正在运行，无法删除。' });
      continue;
    }
    if (mode === 'archive') {
      try {
        await ctx.workspaceRegistry.archiveSession(id, { stopActivity: true });
        done.push({ sessionId: id, mode: 'archive' });
      } catch (error) {
        errors.push({ sessionId: id, code: 'ARCHIVE_FAILED', message: error?.message ?? '归档失败' });
      }
      continue;
    }

    const found = dirMap.get(id);
    if (!found) {
      /* No log on disk: just detach the dangling reference. */
      const workspaceId = await detachSession(ctx, id);
      done.push({ sessionId: id, mode: 'trash', detachedOnly: true, workspaceId });
      continue;
    }
    let info;
    try {
      info = await sessionInfo(
        ctx,
        id,
        undefined,
        dirMap,
        running,
        registry,
      );
    } catch {
      info = { title: id, sizeBytes: dirSize(found.dir) };
    }
    const workspace = workspaceContaining(ctx, id);
    try {
      const moved = moveToTrash(id, found.dir, {
        title: info.title,
        workspaceId: workspace?.id ?? null,
        workspaceTitle: workspace?.title ?? '',
        workspacePath: workspace?.path ?? '',
        originalDir: found.dir,
        wasArchived: registry.archived.has(id),
      });
      await detachSession(ctx, id);
      done.push({ sessionId: id, mode: 'trash', trashId: moved.trashId });
    } catch (error) {
      errors.push({ sessionId: id, code: error.code ?? 'DELETE_FAILED', message: error.message });
    }
  }
  return { done, errors };
}

async function restoreSessions(ctx, payload) {
  const sessionIds = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];
  if (sessionIds.length === 0) throw fail('BAD_REQUEST', '没有选择回收站条目。');
  const trash = readTrash();
  const bySession = new Map(trash.map((entry) => [entry.sessionId, entry]));
  const done = [];
  const errors = [];
  for (const rawId of sessionIds) {
    let id;
    try {
      id = assertSessionId(rawId);
    } catch (error) {
      errors.push({ sessionId: String(rawId), code: error.code ?? 'BAD_SESSION_ID', message: error.message });
      continue;
    }
    const entry = bySession.get(id);
    if (!entry) {
      errors.push({ sessionId: id, code: 'NOT_IN_TRASH', message: '回收站中没有这个会话。' });
      continue;
    }
    const trashDir = path.join(trashRoot(), entry.trashId);
    const meta = readJson(path.join(trashDir, META_NAME), null) ?? readJson(path.join(trashDir, LEGACY_META_NAME), null);
    const originalDir = typeof meta?.originalDir === 'string' ? meta.originalDir : '';
    const root = sessionsRoot();
    if (!originalDir || !path.resolve(originalDir).startsWith(path.resolve(root) + path.sep)) {
      errors.push({ sessionId: id, code: 'BAD_ORIGINAL_DIR', message: '回收站元数据的原始路径无效。' });
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(originalDir), { recursive: true });
      if (fs.existsSync(originalDir)) {
        errors.push({ sessionId: id, code: 'TARGET_EXISTS', message: '原路径已存在同名会话目录。' });
        continue;
      }
      fs.renameSync(trashDir, originalDir);
    } catch (error) {
      errors.push({ sessionId: id, code: 'RESTORE_FAILED', message: error?.message ?? '恢复失败' });
      continue;
    }
    try {
      await attachSession(ctx, id, entry.workspaceId, entry.workspacePath, entry.workspaceTitle);
      done.push({ sessionId: id });
    } catch (error) {
      errors.push({ sessionId: id, code: 'ATTACH_FAILED', message: error?.message ?? '恢复后无法挂回工作区' });
    }
  }
  return { done, errors };
}

async function purgeSessions(ctx, payload) {
  const sessionIds = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];
  if (sessionIds.length === 0) throw fail('BAD_REQUEST', '没有选择回收站条目。');
  const trash = readTrash();
  const bySession = new Map(trash.map((entry) => [entry.sessionId, entry]));
  const done = [];
  const errors = [];
  for (const rawId of sessionIds) {
    let id;
    try {
      id = assertSessionId(rawId);
    } catch (error) {
      errors.push({ sessionId: String(rawId), code: error.code ?? 'BAD_SESSION_ID', message: error.message });
      continue;
    }
    const entry = bySession.get(id);
    if (!entry) {
      errors.push({ sessionId: id, code: 'NOT_IN_TRASH', message: '回收站中没有这个会话。' });
      continue;
    }
    const trashDir = path.join(trashRoot(), entry.trashId);
    if (!path.resolve(trashDir).startsWith(path.resolve(trashRoot()) + path.sep)) {
      errors.push({ sessionId: id, code: 'BAD_TRASH_PATH', message: '回收站路径无效。' });
      continue;
    }
    try {
      fs.rmSync(trashDir, { recursive: true, force: true });
    } catch (error) {
      errors.push({ sessionId: id, code: 'PURGE_FAILED', message: error?.message ?? '彻底删除失败' });
      continue;
    }
    try {
      await ctx.workspaceRegistry.unarchiveSession(id);
    } catch {
      /* stale archive flag is harmless */
    }
    try {
      await ctx.workspaceRegistry.unpinSession(id);
    } catch {
      /* ignore */
    }
    await forgetSessionProjection(ctx, id);
    await cleanSessionSpill(ctx, id);
    emitSessionRemoved(ctx, id);
    done.push({ sessionId: id });
  }
  return { done, errors };
}

/* ------------------------------------------------------ permanent delete */

function sessionService(ctx) {
  try {
    if (ctx && typeof ctx.get === 'function') {
      const service = ctx.get('sessions');
      if (service !== undefined) return service;
    }
  } catch {
    /* service lookup is best effort */
  }
  try {
    return ctx ? ctx.sessions : undefined;
  } catch {
    return undefined;
  }
}

function insideDirectory(root, target) {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  return resolved === base || resolved.startsWith(base + path.sep);
}

async function forgetSessionProjection(ctx, sessionId) {
  try {
    if (!ctx || typeof ctx.get !== 'function') return;
    const cache = ctx.get('sessionProjectionCache');
    if (cache && typeof cache.requireTable === 'function') {
      await cache.requireTable().delete(sessionId);
    }
  } catch {
    /* projection cache cleanup is best effort */
  }
}

async function cleanSessionSpill(ctx, sessionId) {
  try {
    if (!ctx || typeof ctx.get !== 'function') return;
    const store = ctx.get('spillStore');
    const root = store && typeof store.root === 'string' ? store.root : '';
    if (!root) return;
    const target = path.join(root, sessionId);
    if (!insideDirectory(root, target) || !fs.existsSync(target)) return;
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    /* spill cleanup is best effort */
  }
}

function removeSessionTranscriptDir(dir) {
  if (!insideDirectory(sessionsRoot(), dir)) {
    throw fail('BAD_SESSION_DIR', '会话目录不在 sessions 根目录下，拒绝删除。');
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

async function subagentDescendantIds(ctx, parentId) {
  const ids = [];
  try {
    const snapshots = await ctx.sessionPersistence.list();
    for (const snapshot of snapshots) {
      const header = snapshot && snapshot.header;
      if (!header || typeof header.id !== 'string' || header.id === parentId) continue;
      if (header.origin === 'subagent' && header.parentSession === parentId) ids.push(header.id);
    }
  } catch {
    /* descendant lookup is best effort */
  }
  return ids;
}

function emitSessionRemoved(ctx, sessionId) {
  try {
    if (ctx && typeof ctx.emit === 'function') ctx.emit('api-session/removed', sessionId);
  } catch {
    /* listeners are best effort */
  }
}

async function detachLiveSession(ctx, sessionId) {
  const sessions = sessionService(ctx);
  if (!sessions || typeof sessions.get !== 'function') return;
  let live;
  try {
    live = sessions.get(sessionId);
  } catch {
    live = undefined;
  }
  if (!live) return;
  try {
    if (typeof sessions.flush === 'function') await sessions.flush(live);
  } catch {
    /* flush is best effort */
  }
  try {
    if (typeof sessions.liveEntryFor === 'function' && typeof sessions.detachEntered === 'function') {
      await sessions.detachEntered(sessions.liveEntryFor(live));
    }
  } catch {
    /* detach is best effort */
  }
}

async function deleteSessionsPermanently(ctx, payload) {
  const sessionIds = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];
  if (sessionIds.length === 0) throw fail('BAD_REQUEST', '没有选择会话。');
  if (sessionIds.length > 100) throw fail('BAD_REQUEST', '一次最多处理 100 个会话。');
  const running = await runningSet(ctx);
  const done = [];
  const errors = [];
  const pending = [...sessionIds];
  const seen = new Set();
  while (pending.length > 0) {
    const rawId = pending.shift();
    let id;
    try {
      id = assertSessionId(rawId);
    } catch (error) {
      errors.push({ sessionId: String(rawId), code: error.code ?? 'BAD_SESSION_ID', message: error.message });
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    if (running.has(id)) {
      errors.push({ sessionId: id, code: 'SESSION_RUNNING', message: '会话正在运行，无法删除。' });
      continue;
    }
    try {
      const found = listSessionDirs().find((entry) => entry.id === id);
      await detachLiveSession(ctx, id);
      await detachSession(ctx, id);
      await forgetSessionProjection(ctx, id);
      await cleanSessionSpill(ctx, id);
      try {
        await ctx.workspaceRegistry.unarchiveSession(id);
      } catch {
        /* stale archive flag is harmless */
      }
      try {
        await ctx.workspaceRegistry.unpinSession(id);
      } catch {
        /* stale pin flag is harmless */
      }
      if (found) removeSessionTranscriptDir(found.dir);
      emitSessionRemoved(ctx, id);
      done.push({ sessionId: id, mode: 'delete' });
      for (const childId of await subagentDescendantIds(ctx, id)) {
        if (!seen.has(childId) && !running.has(childId)) pending.push(childId);
      }
    } catch (error) {
      errors.push({ sessionId: id, code: error.code ?? 'DELETE_FAILED', message: error?.message ?? '删除失败' });
    }
  }
  return { done, errors };
}

/* --------------------------------------------------------------- export */

const EXPORT_FORMATS = ['jsonl', 'md', 'txt', 'html', 'zstd'];
const EXPORT_MIME = {
  jsonl: 'application/jsonl;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  html: 'text/html;charset=utf-8',
  zstd: 'application/octet-stream',
};

function normalizeExportFormat(value) {
  return EXPORT_FORMATS.includes(value) ? value : 'md';
}

function contentTextOf(content) {
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const part of content) {
    if (part && part.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') {
      parts.push(part.text);
    }
  }
  return parts.join('\n\n').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExportTime(value) {
  const ms = typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function transcriptBlocks(events) {
  const blocks = [];
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const data = event.data && typeof event.data === 'object' ? event.data : {};
    if (event.type === 'user/message') {
      const text = contentTextOf(data.content);
      if (text) blocks.push({ kind: 'user', text, tools: [] });
      continue;
    }
    if (event.type !== 'assistant/message') continue;
    const content = data.message && Array.isArray(data.message.content) ? data.message.content : [];
    const tools = [];
    for (const part of content) {
      if (!part || part.type !== 'tool-call') continue;
      const toolName = typeof part.name === 'string'
        ? part.name
        : typeof part.toolName === 'string' ? part.toolName : 'tool';
      tools.push(toolName);
    }
    const text = contentTextOf(content);
    if (text || tools.length > 0) blocks.push({ kind: 'assistant', text, tools });
  }
  return blocks;
}

function exportMetaLines(meta, count) {
  return [
    `会话 ID：${meta.sessionId}`,
    `工作区：${meta.cwd || '—'}`,
    `最后活动：${formatExportTime(meta.updatedAt)}`,
    `消息数：${count}`,
  ];
}

function buildMarkdownExport(meta, blocks) {
  const lines = [
    `# ${meta.title}`,
    '',
    ...exportMetaLines(meta, blocks.length).map((line) => `> ${line}`),
    '',
    '---',
    '',
  ];
  for (const block of blocks) {
    if (block.kind === 'user') {
      lines.push('## 用户', '', block.text, '');
      continue;
    }
    lines.push('## 助手', '');
    if (block.text) lines.push(block.text, '');
    if (block.tools.length > 0) lines.push(`> 工具调用：${block.tools.join('、')}`, '');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function buildTextExport(meta, blocks) {
  const lines = [meta.title, '', ...exportMetaLines(meta, blocks.length), '', '----------', ''];
  for (const block of blocks) {
    lines.push(`[${block.kind === 'user' ? '用户' : '助手'}]`, '');
    if (block.text) lines.push(block.text, '');
    if (block.tools.length > 0) lines.push(`（工具调用：${block.tools.join('、')}）`, '');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function buildHtmlExport(meta, blocks) {
  const sections = blocks.map((block) => {
    const tools = block.tools.length > 0
      ? `\n      <div class="tools">工具调用：${escapeHtml(block.tools.join('、'))}</div>`
      : '';
    return `    <section class="msg ${block.kind}">
      <div class="role">${block.kind === 'user' ? '用户' : '助手'}</div>
      <div class="text">${escapeHtml(block.text)}</div>${tools}
    </section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<style>
:root{color-scheme:light dark;--bg:#f7f7f8;--card:#ffffff;--text:#1c1c1e;--muted:#6b6b70;--border:#e3e3e6;--user:#eef2ff;--assistant:#f3f7f3}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1c1c1f;--text:#e6e6ea;--muted:#9a9aa2;--border:#33333a;--user:#23283a;--assistant:#1f2a22}}
*{box-sizing:border-box}
body{margin:0;padding:32px 18px 56px;background:var(--bg);color:var(--text);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
main{max-width:860px;margin:0 auto}
h1{font-size:22px;line-height:1.35;margin:0 0 10px}
.meta{color:var(--muted);font-size:12px;line-height:1.7;margin:0 0 26px;white-space:pre-line}
.msg{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin:0 0 14px}
.msg.user{background:var(--user)}
.msg.assistant{background:var(--assistant)}
.role{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px}
.text{white-space:pre-wrap;word-break:break-word}
.tools{margin-top:8px;font-size:12px;color:var(--muted)}
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(meta.title)}</h1>
  <p class="meta">${escapeHtml(exportMetaLines(meta, blocks.length).join('\n'))}</p>
${sections}
</main>
</body>
</html>
`;
}

async function exportSession(ctx, payload) {
  const id = assertSessionId(payload?.sessionId);
  const format = normalizeExportFormat(payload?.format);
  const dir = listSessionDirs().find((entry) => entry.id === id);
  const logFile = dir ? sessionLogFile(dir.dir) : null;

  if (format === 'zstd') {
    if (!logFile) throw fail('EXPORT_UNAVAILABLE', '找不到这个会话的原始日志文件。');
    const buffer = fs.readFileSync(logFile);
    return {
      sessionId: id,
      format,
      mime: EXPORT_MIME[format],
      encoding: 'base64',
      fileName: `${id}.jsonl.zstd`,
      content: buffer.toString('base64'),
      bytes: buffer.length,
    };
  }

  let text = '';
  if (logFile && hasZstd()) {
    try {
      text = decodeZstdLog(logFile).text;
    } catch {
      text = '';
    }
  }
  if (!text) {
    const events = await readEventsViaPersistence(ctx, id);
    text = events.map((event) => JSON.stringify(event)).join('\n');
  }
  if (!text) throw fail('EXPORT_EMPTY', '这个会话没有可导出的日志。');

  if (format === 'jsonl') {
    return {
      sessionId: id,
      format,
      mime: EXPORT_MIME[format],
      encoding: 'utf8',
      fileName: `${id}.jsonl`,
      content: text,
      bytes: Buffer.byteLength(text, 'utf8'),
    };
  }

  const events = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      /* skip a malformed line instead of failing the whole export */
    }
  }
  const header = events.find((event) => event && event.type === 'session') ?? {};
  let derivedTitle = '';
  for (const event of events) {
    if (event && event.type === 'session/title' && event.data && typeof event.data.title === 'string') {
      derivedTitle = event.data.title;
    }
  }
  const blocks = transcriptBlocks(events);
  const meta = {
    title: String(payload?.title ?? '').trim() || derivedTitle || `会话 ${id}`,
    sessionId: id,
    cwd: typeof header.cwd === 'string' ? header.cwd : '',
    updatedAt: typeof payload?.updatedAt === 'number' ? payload.updatedAt : Date.now(),
  };
  const body = format === 'md'
    ? buildMarkdownExport(meta, blocks)
    : format === 'txt'
      ? buildTextExport(meta, blocks)
      : buildHtmlExport(meta, blocks);
  return {
    sessionId: id,
    format,
    mime: EXPORT_MIME[format],
    encoding: 'utf8',
    fileName: `${id}.${format}`,
    content: body,
    bytes: Buffer.byteLength(body, 'utf8'),
  };
}

async function cleanBlankSessions(ctx) {
  const running = await runningSet(ctx);
  const registry = readRegistryState();
  const dirMap = new Map(listSessionDirs().map((entry) => [entry.id, entry]));
  const snapshotMap = new Map();
  try {
    for (const snapshot of await ctx.sessionPersistence.list()) {
      if (snapshot?.header?.id) snapshotMap.set(snapshot.header.id, snapshot);
    }
  } catch {
    /* ignore */
  }
  const blank = [];
  for (const workspace of ctx.workspaceRegistry.list()) {
    for (const id of workspace.sessionIds) {
      if (running.has(id)) continue;
      try {
        const info = await sessionInfo(ctx, id, snapshotMap.get(id), dirMap, running, registry);
        if (info.blank && !info.missingLog) blank.push(id);
      } catch {
        /* skip */
      }
    }
  }
  if (blank.length === 0) return { done: [], errors: [] };
  return deleteSessions(ctx, { sessionIds: blank, mode: 'trash' });
}

/* ------------------------------------------------------------------- http */

function writeJsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function writeOk(res, value) {
  writeJsonResponse(res, 200, { ok: true, value });
}

function writeError(res, code, message) {
  writeJsonResponse(res, 200, { ok: false, error: { code, message } });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw fail('BODY_TOO_LARGE', '请求体过大。');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw fail('BAD_JSON', '请求体不是合法 JSON。');
  }
}

/* --------------------------------------------------------- plugin inventory */

const inventoryCache = { at: 0, value: null };
const INVENTORY_TTL = 30_000;

function normalizeModuleName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** `@deepseek-ai/cordis-plugin-timer` → `timer`；`@deepseek-ai/dsh-llm` → `llm`。 */
function shortModuleName(value) {
  let name = String(value ?? '').trim();
  if (!name) return '';
  if (name.startsWith('@')) {
    const slash = name.indexOf('/');
    if (slash !== -1) name = name.slice(slash + 1);
  }
  return name.replace(/^cordis-plugin-/, '').replace(/^dsh-/, '');
}

function pickLocalized(value, language) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return null;
  const pick = (key) =>
    key && typeof value[key] === 'string' && value[key] !== '' ? value[key] : null;
  if (language) {
    const base = String(language).split('-')[0];
    const direct = pick(language) ?? pick(base) ?? pick(base.toLowerCase());
    if (direct) return direct;
  }
  return (
    pick('en') ??
    Object.values(value).find((entry) => typeof entry === 'string' && entry !== '') ??
    null
  );
}

const CJK_TEXT = /[\u3400-\u9fff]/;

function pickChinese(value) {
  if (!value) return null;
  if (typeof value === 'string') return CJK_TEXT.test(value) ? value : null;
  if (typeof value !== 'object') return null;
  for (const key of ['zh', 'zh-CN', 'zh-Hans', 'zh-Hant', 'zh-TW']) {
    const text = value[key];
    if (typeof text === 'string' && text !== '') return text;
  }
  const first = Object.values(value).find(
    (entry) => typeof entry === 'string' && entry !== '' && CJK_TEXT.test(entry),
  );
  return typeof first === 'string' ? first : null;
}

/**
 * DSH 内置模块与结构节点的中文名。模块名或官方中文名有变动时同步更新这里，
 * 未命中时Inventory 会回退到模块名本身。
 */
const BUILTIN_TITLES_ZH = {
  'cordis:include': '插件包含节点',
  'cordis:group': '插件分组',
  'timer': '计时服务',
  'hmr': 'Web 客户端热更新',
  'plugin-manager': '插件管理',
  'plugin-manager/tools': '插件管理·工具',
};

function builtinTitleZh(moduleName) {
  if (typeof moduleName !== 'string' || moduleName === '') return null;
  return (
    BUILTIN_TITLES_ZH[moduleName] ??
    BUILTIN_TITLES_ZH[moduleName.toLowerCase()] ??
    (moduleName.startsWith('cordis:')
      ? BUILTIN_TITLES_ZH['cordis:' + moduleName.slice('cordis:'.length)]
      : null) ??
    null
  );
}

function uniqueSuffixTitle(index, key) {
  if (!key || key.length < 3) return null;
  const matches = new Map();
  for (const row of index) {
    if (!row.zh || row.norm === key) continue;
    if (!row.norm.endsWith(key) && !key.endsWith(row.norm)) continue;
    if (!matches.has(row.zh)) matches.set(row.zh, row.en ?? null);
  }
  if (matches.size !== 1) return null;
  const [zh, en] = [...matches.entries()][0];
  return { zh, en };
}

/**
 * Read the host plugin inventory and join it with the profile's bundle rows so
 * the panel page can show versions, origins and load state next to each entry.
 * Read-only: nothing here changes enablement.
 */
async function readPluginInventory(ctx) {
  const now = Date.now();
  if (inventoryCache.value && now - inventoryCache.at < INVENTORY_TTL) return inventoryCache.value;
  const manager = typeof ctx.get === 'function' ? ctx.get('pluginManager') : undefined;
  if (!manager || typeof manager.listPlugins !== 'function') {
    const unsupported = { supported: false, reason: 'manager-missing', items: [] };
    inventoryCache.at = now;
    inventoryCache.value = unsupported;
    return unsupported;
  }
  let plugins = [];
  let bundles = [];
  let failure = null;
  try {
    plugins = await manager.listPlugins();
  } catch (error) {
    plugins = [];
    failure = error instanceof Error ? error.message : String(error);
  }
  try {
    if (typeof manager.listBundles === 'function') bundles = await manager.listBundles();
  } catch (error) {
    bundles = [];
    if (!failure) failure = error instanceof Error ? error.message : String(error);
  }
  const byModule = new Map();
  const rowsByRowId = new Map();
  const suffixIndex = [];
  for (const bundle of Array.isArray(bundles) ? bundles : []) {
    const rows = Array.isArray(bundle?.rows) ? bundle.rows : [];
    const bundleZh = pickChinese(bundle?.meta?.title);
    const bundleNorm = normalizeModuleName(bundle?.name);
    if (bundleZh && bundleNorm) suffixIndex.push({ norm: bundleNorm, zh: bundleZh, en: pickLocalized(bundle?.meta?.title) });
    for (const row of rows) {
      const key = normalizeModuleName(row?.moduleName);
      if (!key) continue;
      const shortKey = normalizeModuleName(shortModuleName(row?.moduleName));
      const titleValue = row?.meta?.title ?? bundle?.meta?.title ?? null;
      const descriptionValue = row?.meta?.description ?? bundle?.meta?.description ?? null;
      const zhTitle = pickChinese(titleValue) ?? bundleZh;
      const info = {
        version: typeof bundle.version === 'string' ? bundle.version : null,
        official: bundle.official === true,
        availability: typeof bundle.availability === 'string' ? bundle.availability : null,
        removable: bundle.removable === true,
        source: typeof bundle.source === 'string' ? bundle.source : null,
        bundle: typeof bundle.name === 'string' ? bundle.name : null,
        title: titleValue,
        titleEn: pickLocalized(titleValue),
        titleZh: zhTitle,
        description: descriptionValue,
        icon: typeof row.meta?.icon === 'string' ? row.meta.icon : typeof bundle.meta?.icon === 'string' ? bundle.meta.icon : null,
      };
      byModule.set(key, info);
      if (shortKey && shortKey !== key && !byModule.has(shortKey)) byModule.set(shortKey, info);
      if (typeof row?.rowId === 'string' && row.rowId) rowsByRowId.set(row.rowId, { info, moduleName: row.moduleName });
      if (zhTitle) {
        suffixIndex.push({ norm: key, zh: zhTitle, en: pickLocalized(titleValue) });
        if (shortKey && shortKey !== key) {
          suffixIndex.push({ norm: shortKey, zh: zhTitle, en: pickLocalized(titleValue) });
        }
      }
    }
  }
  const items = (Array.isArray(plugins) ? plugins : []).map((entry) => {
    const key = normalizeModuleName(entry?.moduleName);
    const shortName = shortModuleName(entry?.moduleName) || String(entry?.moduleName ?? '');
    const shortKey = normalizeModuleName(shortName);
    const info = byModule.get(key) ?? (shortKey ? byModule.get(shortKey) : null) ?? null;
    const suffixTitle = uniqueSuffixTitle(suffixIndex, key) ?? uniqueSuffixTitle(suffixIndex, shortKey);
    const zhTitle =
      info?.titleZh ??
      builtinTitleZh(shortName) ??
      builtinTitleZh(entry?.moduleName) ??
      suffixTitle?.zh ??
      null;
    return {
      entryId: typeof entry?.entryId === 'string' ? entry.entryId : null,
      moduleName: typeof entry?.moduleName === 'string' ? entry.moduleName : null,
      shortName,
      key,
      enabled: entry?.enabled === true,
      fiberPhase: typeof entry?.fiberPhase === 'string' ? entry.fiberPhase : null,
      readOnlyReason: typeof entry?.readOnlyReason === 'string' ? entry.readOnlyReason : null,
      patchId: typeof entry?.patchId === 'string' ? entry.patchId : null,
      version: info?.version ?? null,
      official: info?.official ?? null,
      availability: info?.availability ?? null,
      removable: info?.removable ?? null,
      source: info?.source ?? null,
      bundle: info?.bundle ?? null,
      title: info?.title ?? suffixTitle?.en ?? zhTitle ?? null,
      titleZh: zhTitle,
      description: info?.description ?? null,
      icon: info?.icon ?? null,
    };
  });
  const presentIds = new Set(items.map((item) => normalizeModuleName(item.entryId)).filter(Boolean));
  const presentModules = new Set(items.map((item) => normalizeModuleName(item.moduleName)).filter(Boolean));
  const ghosts = [];
  for (const patch of readDisabledPatches()) {
    const idKey = normalizeModuleName(patch.id);
    if (!idKey || presentIds.has(idKey)) continue;
    const matched = rowsByRowId.get(patch.id);
    const moduleName = patch.name || matched?.moduleName || patch.id;
    const key = normalizeModuleName(moduleName);
    if (!key || presentModules.has(key)) continue;
    const shortName = shortModuleName(moduleName) || String(moduleName);
    const shortKey = normalizeModuleName(shortName);
    const info = matched?.info ?? byModule.get(key) ?? (shortKey ? byModule.get(shortKey) : null) ?? null;
    const suffixTitle = uniqueSuffixTitle(suffixIndex, key) ?? uniqueSuffixTitle(suffixIndex, shortKey);
    const zhTitle =
      info?.titleZh ??
      builtinTitleZh(shortName) ??
      builtinTitleZh(moduleName) ??
      suffixTitle?.zh ??
      null;
    ghosts.push({
      entryId: patch.id,
      moduleName,
      shortName,
      key,
      enabled: false,
      fiberPhase: null,
      readOnlyReason: null,
      patchId: patch.id,
      disabledByProfile: true,
      version: info?.version ?? null,
      official: info?.official ?? null,
      availability: info?.availability ?? null,
      removable: info?.removable ?? null,
      source: info?.source ?? null,
      bundle: info?.bundle ?? null,
      title: info?.title ?? suffixTitle?.en ?? zhTitle ?? null,
      titleZh: zhTitle,
      description: info?.description ?? null,
      icon: info?.icon ?? null,
    });
  }
  const allItems = items.concat(ghosts);
  const value = failure
    ? { supported: true, items: allItems, warning: failure }
    : { supported: true, items: allItems };
  inventoryCache.at = now;
  inventoryCache.value = value;
  return value;
}

/**
 * Split every inventory row into its composition plane(s): rows mounted by the
 * host Loader are global, rows declared by an Agent preset are session-scoped,
 * and the same module can be both (the base composition mounts many tools that
 * presets also declare). Read-only: preset rows are managed by the preset, not
 * by this plugin.
 */
const scopeCache = { at: 0, value: null };
const SCOPE_TTL = 30_000;

async function readPluginScopes(ctx) {
  const now = Date.now();
  if (scopeCache.value && now - scopeCache.at < SCOPE_TTL) return scopeCache.value;
  const inventory = await readPluginInventory(ctx);
  const items = (Array.isArray(inventory.items) ? inventory.items : []).map((item) => ({
    ...item,
    scopes: ['global'],
    presets: [],
  }));
  const presetsService = typeof ctx.get === 'function' ? ctx.get('agentPresets') : undefined;
  const supported = Boolean(
    presetsService && typeof presetsService.compositionInventory === 'function',
  );
  let warning = typeof inventory.warning === 'string' ? inventory.warning : null;
  const presets = [];
  const presetRows = [];
  if (supported) {
    let compositions = [];
    let registry = [];
    try {
      compositions = await presetsService.compositionInventory();
    } catch (error) {
      warning = warning ?? (error instanceof Error ? error.message : String(error));
      compositions = [];
    }
    try {
      if (typeof presetsService.list === 'function') registry = await presetsService.list();
    } catch {
      registry = [];
    }
    const registryNames = new Map();
    for (const row of Array.isArray(registry) ? registry : []) {
      if (!row || typeof row.id !== 'string') continue;
      registryNames.set(row.id, typeof row.name === 'string' && row.name ? row.name : row.id);
    }
    for (const composition of Array.isArray(compositions) ? compositions : []) {
      const id = typeof composition?.id === 'string' ? composition.id : null;
      if (!id) continue;
      const name =
        typeof composition?.name === 'string' && composition.name
          ? composition.name
          : (registryNames.get(id) ?? id);
      const preset = {
        id,
        name,
        default: composition?.isDefault === true,
        broken: composition?.broken === true,
      };
      presets.push(preset);
      for (const row of Array.isArray(composition?.rows) ? composition.rows : []) {
        const moduleName = typeof row?.moduleName === 'string' ? row.moduleName : '';
        if (!moduleName) continue;
        presetRows.push({
          preset,
          entryId: typeof row?.entryId === 'string' ? row.entryId : null,
          moduleName,
          enabled: row?.enabled === true ? true : row?.enabled === 'conditional' ? 'conditional' : false,
          condition: typeof row?.condition === 'string' ? row.condition : null,
          fiberState: typeof row?.fiberState === 'string' ? row.fiberState : null,
        });
      }
    }
  }
  const byKey = new Map();
  for (const item of items) {
    if (item.key) byKey.set(item.key, item);
    const shortKey = normalizeModuleName(item.shortName);
    if (shortKey && !byKey.has(shortKey)) byKey.set(shortKey, item);
  }
  const presetInfo = (row) => ({
    id: row.preset.id,
    name: row.preset.name,
    default: row.preset.default === true,
    enabled: row.enabled,
    condition: row.condition,
  });
  const seenModules = new Set();
  for (const row of presetRows) {
    const key = normalizeModuleName(row.moduleName);
    if (!key) continue;
    const target = byKey.get(key) ?? byKey.get(normalizeModuleName(shortModuleName(row.moduleName)));
    if (!target) continue;
    if (!target.presets.some((preset) => preset.id === row.preset.id)) {
      target.presets.push(presetInfo(row));
    }
    if (target.scopes.indexOf('session') === -1) target.scopes.push('session');
    seenModules.add(key);
  }
  // Preset-only rows (e.g. `persona`): synthesize inventory entries so the
  // list can label and filter them, marked read-only and unremovable.
  const synthetic = new Map();
  for (const row of presetRows) {
    const key = normalizeModuleName(row.moduleName);
    if (!key || seenModules.has(key)) continue;
    if (byKey.has(key) || byKey.has(normalizeModuleName(shortModuleName(row.moduleName)))) continue;
    let item = synthetic.get(key);
    if (!item) {
      item = {
        entryId: row.entryId,
        moduleName: row.moduleName,
        shortName: shortModuleName(row.moduleName) || row.moduleName,
        key,
        enabled: true,
        fiberPhase: row.fiberState ?? null,
        readOnlyReason: 'preset-managed',
        patchId: null,
        version: null,
        official: null,
        availability: null,
        removable: false,
        source: null,
        bundle: null,
        title: row.moduleName,
        titleZh: null,
        description: null,
        icon: null,
        scopes: ['session'],
        presets: [],
      };
      synthetic.set(key, item);
    }
    if (!item.presets.some((preset) => preset.id === row.preset.id)) {
      item.presets.push(presetInfo(row));
    }
    if (typeof row.entryId === 'string' && row.entryId && !item.entryId) item.entryId = row.entryId;
    seenModules.add(key);
  }
  const value = {
    supported,
    presets,
    items: [...items, ...synthetic.values()],
    ...(warning ? { warning } : {}),
  };
  scopeCache.at = now;
  scopeCache.value = value;
  return value;
}

/* ------------------------------------------------------------ notifications */

const NOTIFY_LIMIT = 100;
const notificationQueue = [];
const recentNotificationKeys = new Map();
let notificationSeq = 0;
// Identifies this host process: the client keeps its cursor across page reloads
// but the in-memory sequence restarts with the process, so a changed epoch
// tells the client to discard a stale cursor instead of missing new items.
const notificationEpoch = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const NOTIFY_DEBUG_PATH = () => path.join(dataDir(), 'notify-debug.log');
const NOTIFY_DEBUG_CAP = 512 * 1024;

/**
 * Append one diagnostic line for the notification pipeline. The desktop app
 * hides the host console, so both host events and client-side steps are
 * written to a small capped file the user can hand back when a reminder does
 * not appear.
 */
function debugLine(ctx, tag, data) {
  try {
    const file = NOTIFY_DEBUG_PATH();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const stamp = new Date().toISOString();
    const payload = data === undefined ? '' : ` ${JSON.stringify(data)}`;
    fs.appendFileSync(file, `${stamp} [${tag}]${payload}\n`, 'utf8');
    const stat = fs.statSync(file);
    if (stat.size > NOTIFY_DEBUG_CAP) {
      fs.writeFileSync(file, `${stamp} [debug] log rotated\n`, 'utf8');
    }
  } catch (error) {
    try {
      ctx?.logger?.warn?.('[dsh-keeper] debug log failed', error);
    } catch {
      /* ignore */
    }
  }
}

const notificationMetaCache = new Map();

/** The last real user prompt, skipping the injected time-context snapshot. */
function lastUserExcerpt(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event || event.type !== 'user/message') continue;
    const source = event.data && event.data.source;
    if (source && source.kind === 'time-context') continue;
    const text = messageText(event.data);
    if (text) return truncate(text, 20);
  }
  return '';
}

/** The last assistant answer, used as the task summary in a notification. */
function lastAssistantExcerpt(events, max) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event || event.type !== 'assistant/message') continue;
    const text = messageText(event.data);
    if (text) return truncate(stripMarkdown(text), max);
  }
  return '';
}

function notificationMetaFromEvents(events) {
  let title = '';
  let model = '';
  let cwd = '';
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    if (event.type === 'session/title' && event.data && typeof event.data.title === 'string') {
      const candidate = event.data.title.trim();
      if (candidate) title = candidate;
    } else if (event.type === 'model/selection' && event.data && typeof event.data.model === 'string') {
      model = event.data.model.trim();
    } else if (event.type === 'session' && typeof event.cwd === 'string' && !cwd) {
      cwd = event.cwd;
    }
  }
  return {
    title: title || lastUserExcerpt(events),
    model,
    cwd,
    summary: lastAssistantExcerpt(events, 100),
  };
}

function workspaceLabelFor(ctx, cwd) {
  if (!cwd) return '';
  try {
    const registry = ctx.workspaceRegistry;
    if (registry && typeof registry.resolveByPath === 'function') {
      const workspace = registry.resolveByPath(cwd);
      if (workspace && typeof workspace.title === 'string' && workspace.title) return workspace.title;
    }
  } catch {
    /* fall back to the folder name */
  }
  try {
    return path.basename(cwd);
  } catch {
    return '';
  }
}

/**
 * Resolve the friendly bits of a notification: the session title with a
 * message-excerpt fallback (never the raw session id), the workspace label and
 * the selected model. Prefers live events, then the persisted log.
 */
function notificationMeta(ctx, session, sessionId) {
  const headerCwd =
    session && session.header && typeof session.header.cwd === 'string' ? session.header.cwd : '';
  let events = [];
  if (session && typeof session.snapshotEvents === 'function') {
    try {
      events = session.snapshotEvents() || [];
    } catch {
      events = [];
    }
  }
  const cached = sessionId ? notificationMetaCache.get(sessionId) : undefined;
  if (!events.length && cached && Date.now() - cached.at < 15000) return cached.value;
  if (!events.length && sessionId) {
    try {
      const live = ctx.sessions && typeof ctx.sessions.get === 'function' ? ctx.sessions.get(sessionId) : undefined;
      if (live && typeof live.snapshotEvents === 'function') events = live.snapshotEvents() || [];
    } catch {
      events = [];
    }
  }
  if (!events.length && sessionId) {
    // The live session may already be gone when the notification is read; fall
    // back to the persisted log so the toast never shows a raw session id.
    try {
      const found = listSessionDirs().find((entry) => entry.id === sessionId);
      const logFile = found ? sessionLogFile(found.dir) : null;
      if (logFile && hasZstd()) events = decodeZstdLog(logFile).events;
    } catch {
      events = [];
    }
  }
  const derived = events.length
    ? notificationMetaFromEvents(events)
    : { title: '', model: '', cwd: '', summary: '' };
  const value = {
    title: derived.title,
    model: derived.model,
    workspace: workspaceLabelFor(ctx, derived.cwd || headerCwd),
    summary: derived.summary || '',
  };
  if (sessionId) {
    notificationMetaCache.set(sessionId, { at: Date.now(), value });
    if (notificationMetaCache.size > 200) notificationMetaCache.clear();
  }
  return value;
}

function pushNotification(ctx, entry) {
  const now = Date.now();
  const dedupeKey = `${entry.kind}|${entry.sessionId ?? ''}|${entry.detail ?? ''}`;
  const previous = recentNotificationKeys.get(dedupeKey);
  if (previous !== undefined && now - previous < 3000) {
    debugLine(ctx, 'push-skip', { kind: entry.kind, sessionId: entry.sessionId ?? '', detail: entry.detail ?? '' });
    return null;
  }
  recentNotificationKeys.set(dedupeKey, now);
  if (recentNotificationKeys.size > 200) recentNotificationKeys.clear();

  notificationSeq += 1;
  const sessionId = entry.sessionId ?? '';
  const meta = sessionId
    ? notificationMeta(ctx, entry.session, sessionId)
    : { title: '', model: '', workspace: '', summary: '' };
  const rawSummary =
    entry.summary || (entry.kind === 'error' ? entry.detail : '') || meta.summary || '';
  const summary = truncate(stripMarkdown(String(rawSummary)), 100);
  const owner = sessionId ? workspaceContaining(ctx, sessionId) : null;
  const notification = {
    id: String(notificationSeq),
    kind: entry.kind,
    sessionId,
    title: meta.title,
    workspace: meta.workspace,
    workspaceId: owner?.id ?? '',
    model: meta.model,
    summary,
    detail: entry.detail ?? '',
    at: now,
    ...(entry.approval ? { approval: true } : {}),
    ...(Number.isFinite(entry.questionCount) ? { questionCount: entry.questionCount } : {}),
  };
  notificationQueue.push(notification);
  if (notificationQueue.length > NOTIFY_LIMIT) {
    notificationQueue.splice(0, notificationQueue.length - NOTIFY_LIMIT);
  }
  debugLine(ctx, 'push', {
    id: notification.id,
    kind: notification.kind,
    sessionId: notification.sessionId,
    title: notification.title,
    detail: notification.detail,
  });
  return notification;
}

function readNotifications(ctx, payload) {
  const after = Number(payload && payload.after);
  const items =
    Number.isFinite(after) && after > 0
      ? notificationQueue.filter((item) => Number(item.id) > after)
      : notificationQueue.slice();
  // Late metadata resolution: a notification may be queued before the title or
  // model is available, so fill the gaps the first time it is read.
  for (const item of items) {
    if (!item.sessionId) continue;
    if (!item.workspaceId) {
      const owner = workspaceContaining(ctx, item.sessionId);
      if (owner) item.workspaceId = owner.id;
    }
    if (item.title && item.workspace && item.model && item.summary) continue;
    const meta = notificationMeta(ctx, null, item.sessionId);
    if (!item.title && meta.title) item.title = meta.title;
    if (!item.workspace && meta.workspace) item.workspace = meta.workspace;
    if (!item.model && meta.model) item.model = meta.model;
    if (!item.summary && meta.summary) item.summary = meta.summary;
  }
  const state = readState();
  if (items.length > 0) {
    debugLine(ctx, 'read', { after, count: items.length, latest: String(notificationSeq) });
  }
  return {
    items,
    latest: String(notificationSeq),
    epoch: notificationEpoch,
    // The notifier runs outside the plugin panel, so it needs the live settings
    // with every poll instead of a bootstrap snapshot that may be stale.
    settings: normalizeNotificationSettings(state.settings && state.settings.notifications),
  };
}

const callSessionCache = new Map();

function liveSessions(ctx) {
  try {
    const sessions = ctx && ctx.sessions;
    if (!sessions) return [];
    if (typeof sessions.list === 'function') {
      const listed = sessions.list();
      if (Array.isArray(listed)) return listed;
    }
    if (typeof sessions.values === 'function') {
      const values = sessions.values();
      if (Array.isArray(values)) return values;
    }
  } catch {
    /* ignore */
  }
  return [];
}

// Legacy (non-timed) questions carry no agent, only the tool call id from the
// session stream. Find the owning session so the reminder still names it.
function sessionIdForCallId(ctx, callId) {
  if (!callId) return '';
  const cached = callSessionCache.get(callId);
  if (cached && Date.now() - cached.at < 60000) return cached.sessionId;
  let result = '';
  for (const session of liveSessions(ctx)) {
    try {
      const events = session && typeof session.snapshotEvents === 'function' ? session.snapshotEvents() || [] : [];
      const match = events.some(
        (event) => event && event.type === 'tool/call' && event.data && String(event.data.callId) === String(callId),
      );
      if (match) {
        result = String((session && session.id) || '');
        break;
      }
    } catch {
      /* keep scanning */
    }
  }
  if (result) {
    if (callSessionCache.size > 200) callSessionCache.clear();
    callSessionCache.set(callId, { sessionId: result, at: Date.now() });
  } else {
    debugLine(ctx, 'callid-miss', { callId, live: liveSessions(ctx).length });
  }
  return result;
}

// Short, human-readable summaries for the "waiting for you" reminders.
function questionSummary(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return '';
  const first = questions[0];
  const fields = ['question', 'text', 'prompt', 'header', 'title'];
  for (const field of fields) {
    const value = first && first[field];
    if (typeof value === 'string' && value.trim()) return truncate(value, 100);
  }
  return '';
}

function approvalSummary(request) {
  const fields = ['prompt', 'title', 'description', 'message', 'reason'];
  for (const field of fields) {
    const value = request && request[field];
    if (typeof value === 'string' && value.trim()) return truncate(value, 100);
  }
  return '';
}

function installNotificationWatchers(ctx) {
  const disposers = [];

  if (typeof ctx.on === 'function') {
    disposers.push(
      ctx.on('session/event', (session, event) => {
        try {
          const header = session && session.header;
          if (header && header.origin === 'subagent') return;
          if (event && event.type === 'tool/call') {
            // The user-question waterfall does not always reach an unscoped
            // listener (legacy asks carry no agent), so the tool call itself is
            // the reliable signal that the model is waiting for an answer.
            const toolName = event.data && event.data.name ? String(event.data.name) : '';
            if (/ask_user/i.test(toolName)) {
              debugLine(ctx, 'ask-toolcall', { toolName, sessionId: session && session.id });
              pushNotification(ctx, {
                kind: 'ask',
                sessionId: session && session.id,
                detail: 'question',
                questionCount: 0,
                session,
              });
            }
            return;
          }
          if (event && event.type === 'approval/asked') {
            // `approval/request` is a scoped waterfall that `dsh-api-remotes`
            // forwards to the Web client first. When the user answers, that
            // listener resolves the waterfall with a result and never calls
            // `next()`, so a later Host listener is never invoked. The durable
            // `approval/asked` audit event is the reliable "user is waiting" signal.
            const data = event.data || {};
            debugLine(ctx, 'approval-asked', {
              sessionId: session && session.id,
              approvalId: data.id ? String(data.id) : '',
              callId: data.callId ? String(data.callId) : '',
              toolName: data.toolName ? String(data.toolName) : '',
            });
            pushNotification(ctx, {
              kind: 'ask',
              sessionId: session && session.id,
              detail: 'approval',
              approval: true,
              summary: approvalSummary({ prompt: data.reason, title: data.toolName }),
              session,
            });
            return;
          }
          if (!event || event.type !== 'turn/end') return;
          const reason = event.data && event.data.reason ? event.data.reason : { kind: 'completed' };
          if (reason.kind === 'forked') return;
          let kind = 'done';
          let detail = '';
          if (reason.kind === 'error') {
            kind = 'error';
            detail = reason.error && reason.error.message ? reason.error.message : '模型请求失败';
          } else if (reason.kind !== 'completed') {
            kind = 'stopped';
            detail = reason.kind;
          }
          pushNotification(ctx, { kind, sessionId: session.id, detail, session });
        } catch (error) {
          try {
            ctx.logger?.warn?.('[dsh-keeper] notification watcher failed', error);
          } catch {
            /* ignore logging failures */
          }
        }
      }),
    );

    disposers.push(
      ctx.on('user-questions/request', function (request, next) {
        try {
          // The scoped agent is passed as the listener receiver; the request
          // payload only carries `agent` on some paths, so accept both.
          const scoped = this && typeof this.id === 'string' ? this : null;
          const agent = (request && request.agent) || scoped;
          const callId = request && request.wait && request.wait.callId ? String(request.wait.callId) : '';
          debugLine(ctx, 'ask-event', {
            agentId: agent && agent.id ? String(agent.id) : '',
            thisId: this && typeof this.id === 'string' ? String(this.id) : '',
            callId,
            questionCount: Array.isArray(request && request.questions) ? request.questions.length : 0,
          });
          if (agent && agent.id) {
            const questions = Array.isArray(request.questions) ? request.questions : [];
            const first = questions[0];
            const intent = first && first.intent ? first.intent.kind : 'question';
            pushNotification(ctx, {
              kind: 'ask',
              sessionId: agent.id,
              detail: intent,
              approval: intent === 'approval',
              questionCount: questions.length,
              summary: questionSummary(questions),
            });
          } else {
            // Legacy asks reach listeners without an agent; map the tool call
            // back to its session instead of dropping the reminder.
            const sessionId = callId ? sessionIdForCallId(ctx, callId) : '';
            if (sessionId) {
              const questions = Array.isArray(request.questions) ? request.questions : [];
              const first = questions[0];
              const intent = first && first.intent ? first.intent.kind : 'question';
              pushNotification(ctx, {
                kind: 'ask',
                sessionId,
                detail: intent,
                approval: intent === 'approval',
                questionCount: questions.length,
                summary: questionSummary(questions),
              });
            }
          }
        } catch {
          /* ignore notification failures; the question must still be asked */
        }
        return next();
      }),
    );

    disposers.push(
      ctx.on('approval/request', function (request, next) {
        try {
          const scoped = this && typeof this.id === 'string' ? this : null;
          const callId = request && request.callId ? String(request.callId) : '';
          debugLine(ctx, 'approval-event', {
            thisId: this && typeof this.id === 'string' ? String(this.id) : '',
            callId,
            sessionId: request && typeof request.sessionId === 'string' ? request.sessionId : '',
          });
          const sessionId =
            request && typeof request.sessionId === 'string'
              ? request.sessionId
              : request && request.agent && request.agent.id
                ? request.agent.id
                : scoped
                  ? scoped.id
                  : callId
                    ? sessionIdForCallId(ctx, callId)
                    : '';
          if (sessionId) {
            pushNotification(ctx, {
              kind: 'ask',
              sessionId,
              detail: 'approval',
              approval: true,
              summary: approvalSummary(request),
            });
          }
        } catch {
          /* ignore notification failures; approval must still be asked */
        }
        return next();
      }),
    );
  }

  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        /* ignore disposal failures */
      }
    }
  };
}

/* ------------------------------------------------------ notification sounds */

function soundExtFor(buffer) {
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'RIFF') return 'wav';
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  return 'mp3';
}

function findSoundFile(kind) {
  for (const ext of Object.keys(SOUND_MIME)) {
    const file = path.join(soundsDir(), `${kind}.${ext}`);
    try {
      if (fs.existsSync(file)) return { file, ext };
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function saveNotificationSound(ctx, payload) {
  const kind = payload && payload.kind;
  if (!SOUND_KINDS.includes(kind)) throw fail('BAD_REQUEST', '不支持的提示音类型。');
  const rawName = typeof payload?.name === 'string' ? path.basename(payload.name).slice(0, 120) : '';
  let base64 = typeof payload?.data === 'string' ? payload.data : '';
  if (base64.startsWith('data:')) {
    const comma = base64.indexOf(',');
    if (comma !== -1) base64 = base64.slice(comma + 1);
  }
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    throw fail('BAD_REQUEST', '音频内容不是有效的 base64。');
  }
  if (!buffer || buffer.length === 0) throw fail('BAD_REQUEST', '音频文件为空。');
  if (buffer.length > SOUND_MAX_BYTES) throw fail('TOO_LARGE', '音频文件不能超过 2 MB。');
  const ext = soundExtFor(buffer);
  const dir = soundsDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const other of Object.keys(SOUND_MIME)) {
      if (other === ext) continue;
      fs.rmSync(path.join(dir, `${kind}.${other}`), { force: true });
    }
    fs.writeFileSync(path.join(dir, `${kind}.${ext}`), buffer);
  } catch (error) {
    throw fail('IO_ERROR', `写入提示音失败：${error && error.message ? error.message : String(error)}`);
  }
  const state = readState();
  const sounds = { ...state.settings.notifications.sounds, [kind]: { name: rawName || `${kind}.${ext}` } };
  state.settings.notifications = normalizeNotificationSettings({ ...state.settings.notifications, sounds });
  const saved = writeState(state);
  return { kind, name: state.settings.notifications.sounds[kind].name, state: saved };
}

function readNotificationSound(payload) {
  const kind = payload && payload.kind;
  if (!SOUND_KINDS.includes(kind)) throw fail('BAD_REQUEST', '不支持的提示音类型。');
  const found = findSoundFile(kind);
  if (!found) return { kind, name: '', mime: '', data: '' };
  let buffer;
  try {
    buffer = fs.readFileSync(found.file);
  } catch {
    return { kind, name: '', mime: '', data: '' };
  }
  const state = readState();
  const stored = state.settings.notifications.sounds[kind];
  return {
    kind,
    name: stored && stored.name ? stored.name : path.basename(found.file),
    mime: SOUND_MIME[found.ext] || 'audio/mpeg',
    data: buffer.toString('base64'),
  };
}

function clearNotificationSound(payload) {
  const kind = payload && payload.kind;
  if (!SOUND_KINDS.includes(kind)) throw fail('BAD_REQUEST', '不支持的提示音类型。');
  for (const ext of Object.keys(SOUND_MIME)) {
    try {
      fs.rmSync(path.join(soundsDir(), `${kind}.${ext}`), { force: true });
    } catch {
      /* ignore cleanup failures */
    }
  }
  const state = readState();
  const sounds = { ...state.settings.notifications.sounds, [kind]: { name: '' } };
  state.settings.notifications = normalizeNotificationSettings({ ...state.settings.notifications, sounds });
  const saved = writeState(state);
  return { kind, name: '', state: saved };
}

function createApi(ctx) {
  return {
    bootstrap: () => buildBootstrap(ctx),
    deleteSessions: (payload) => deleteSessions(ctx, payload),
    deleteSessionsPermanently: (payload) => deleteSessionsPermanently(ctx, payload),
    restoreSessions: (payload) => restoreSessions(ctx, payload),
    purgeSessions: (payload) => purgeSessions(ctx, payload),
    archiveSessions: (payload) => deleteSessions(ctx, { ...payload, mode: 'archive' }),
    unarchiveSessions: async (payload) => {
      const ids = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];
      const done = [];
      const errors = [];
      for (const rawId of ids) {
        let id;
        try {
          id = assertSessionId(rawId);
        } catch (error) {
          errors.push({ sessionId: String(rawId), code: error.code, message: error.message });
          continue;
        }
        try {
          await ctx.workspaceRegistry.unarchiveSession(id);
          done.push({ sessionId: id });
        } catch (error) {
          errors.push({ sessionId: id, code: 'UNARCHIVE_FAILED', message: error?.message ?? '取消归档失败' });
        }
      }
      return { done, errors };
    },
    cleanBlankSessions: () => cleanBlankSessions(ctx),
    openWorkspacePath: (payload) => openWorkspacePath(ctx, payload),
    pluginInventory: async (payload) => {
      if (payload && payload.refresh === true) inventoryCache.at = 0;
      return readPluginInventory(ctx);
    },
    pluginScopes: async (payload) => {
      if (payload && payload.refresh === true) {
        inventoryCache.at = 0;
        scopeCache.at = 0;
      }
      return readPluginScopes(ctx);
    },
    notifications: async (payload) => readNotifications(ctx, payload),
    debugLog: async (payload) => {
      if (payload && typeof payload.message === 'string') {
        debugLine(ctx, `client:${payload.message}`, payload.data);
      }
      return true;
    },
    saveNotificationSound: (payload) => saveNotificationSound(ctx, payload),
    readNotificationSound: (payload) => readNotificationSound(payload),
    clearNotificationSound: (payload) => clearNotificationSound(payload),
    setPluginEnabled: (payload) => setPluginEnabled(ctx, payload),
    uninstallPlugin: (payload) => uninstallPlugin(ctx, payload),
    enablePluginOverride: (payload) => enablePluginOverride(ctx, payload),
    translateText: (payload) => translateText(ctx, payload),
    clearTranslationCache: () => clearTranslationCache(),
    exportSession: (payload) => exportSession(ctx, payload),
    setHiddenPanels: async (payload) => {
      const ids = Array.isArray(payload?.hiddenPanels)
        ? payload.hiddenPanels.filter((id) => typeof id === 'string' && id.length > 0 && id.length < 200)
        : [];
      const state = readState();
      state.hiddenPanels = [...new Set(ids)];
      const saved = writeState(state);
      return { state: saved };
    },
    saveSettings: async (payload) => {
      const patch = payload?.settings;
      if (!patch || typeof patch !== 'object') throw fail('BAD_REQUEST', '缺少设置内容。');
      const state = readState();
      if (patch.deleteMode === 'trash' || patch.deleteMode === 'delete') {
        state.settings.deleteMode = patch.deleteMode;
      }
      if (typeof patch.confirmPurge === 'boolean') state.settings.confirmPurge = patch.confirmPurge;
      if (EXPORT_FORMATS.includes(patch.defaultExportFormat)) {
        state.settings.defaultExportFormat = patch.defaultExportFormat;
      }
      if (patch.notifications && typeof patch.notifications === 'object') {
        state.settings.notifications = normalizeNotificationSettings({
          ...state.settings.notifications,
          ...patch.notifications,
        });
      }
      const saved = writeState(state);
      return { state: saved };
    },
    resetSettings: async () => {
      const state = readState();
      state.settings = { ...DEFAULT_SETTINGS };
      const saved = writeState(state);
      return { state: saved };
    },
    resetPanels: async () => {
      const state = readState();
      state.hiddenPanels = [];
      const saved = writeState(state);
      return { state: saved };
    },
    emptyTrash: async () => {
      const entries = readTrash();
      return purgeSessions(ctx, { sessionIds: entries.map((entry) => entry.sessionId) });
    },
    ping: async () => ({ pong: true, version: PLUGIN_VERSION, root: dshHome() }),
  };
}

/* ------------------------------------------------------------------- apply */

/**
 * Mount the plugin against the host context.
 * @param ctx - Host context carrying the web server, connection fence and the
 *   session persistence/workspace services.
 */
export function apply(ctx) {
  const api = createApi(ctx);

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: API_PATH,
        handler: async (req, res) => {
          if (ctx.connection.requestRejection(req) !== undefined) {
            res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('forbidden');
            return;
          }
          if (req.method !== 'POST') {
            res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'POST' });
            res.end('method not allowed');
            return;
          }
          const method = new URL(req.url ?? '/', 'http://dsh.internal').pathname
            .slice(API_PATH.length)
            .replace(/^\/+/, '');
          const fn = Object.hasOwn(api, method) ? api[method] : undefined;
          if (method.length === 0 || method.includes('/') || typeof fn !== 'function') {
            writeError(res, 'NOT_FOUND', `Unknown method: ${method}`);
            return;
          }
          try {
            const payload = await readBody(req);
            const value = await fn(payload);
            writeOk(res, value);
          } catch (error) {
            writeError(res, error?.code ?? 'INTERNAL', error?.message ?? String(error));
          }
        },
      }),
    'dsh-keeper: data API',
  );

  ctx.effect(() => {
    migrateLegacyData();
    fs.mkdirSync(trashRoot(), { recursive: true });
    return () => {};
  }, 'dsh-keeper: storage directories');

  ctx.effect(() => installNotificationWatchers(ctx), 'dsh-keeper: notification watchers');
}

/** Exported for tests and for the host package metadata. */
export const plugin = { name, NS, PANEL_ID, version: PLUGIN_VERSION };
export { sessionInfo as _sessionInfo };
