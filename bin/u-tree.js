#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const startArg = args.find((a) => !a.startsWith('--')) || '.';
const configPath = path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || process.cwd(), '.config'), 'u-tree', 'config.json');
const config = loadConfig();

let cwd = path.resolve(process.cwd(), startArg);
let selectedIndex = 0;
let viewportTop = 0;
let filter = '';
let showHidden = flags.has('--hidden') ? true : flags.has('--no-hidden') ? false : config.showHidden ?? true;
let entries = [];
let errorMessage = '';
let previewMode = flags.has('--preview') ? true : flags.has('--no-preview') ? false : config.previewMode ?? false;
let preview = null;
let shortcutMode = false;
let helpMode = false;
let shortcutIndex = 0;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig() {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({
      showHidden,
      previewMode,
      shortcuts: Array.isArray(config.shortcuts) ? config.shortcuts : [],
    }, null, 2));
  } catch {
    // Ignore config write failures; navigation should still work.
  }
}

function shortcuts() {
  if (!Array.isArray(config.shortcuts)) config.shortcuts = [];
  const home = process.env.HOME;
  config.shortcuts = config.shortcuts
    .filter((p) => typeof p === 'string')
    .filter((p, i, arr) => arr.indexOf(p) === i)
    .filter((p) => !home || p !== home);
  return config.shortcuts;
}

function shortcutItems() {
  const home = process.env.HOME || path.resolve('/');
  return [
    { key: 'h', path: home, isHome: true },
    ...shortcuts().slice(0, 10).map((p, i) => ({ key: i === 9 ? '0' : String(i + 1), path: p, isHome: false })),
  ];
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

if (flags.has('--help') || flags.has('-h')) {
  console.log(`u-tree [path] [options]\n\nOptions:\n  --hidden       Show hidden folders\n  --no-hidden    Hide hidden folders\n  --preview      Start with preview mode on\n  --no-preview   Start with preview mode off\n  -h, --help     Show help`);
  process.exit(0);
}

if (!isDir(cwd)) {
  console.error(`u-tree: not a directory: ${startArg}`);
  process.exit(1);
}

function readDirSafe(dir) {
  try {
    return { entries: fs.readdirSync(dir, { withFileTypes: true }), error: '' };
  } catch (err) {
    if (err?.code === 'EACCES' || err?.code === 'EPERM') {
      return { entries: [], error: `permission denied: ${dir}` };
    }
    return { entries: [], error: `${err?.message || err}` };
  }
}

function dirEntries(dir, useFilter = false) {
  const needle = useFilter ? filter.toLowerCase() : '';
  const result = readDirSafe(dir);
  if (useFilter) errorMessage = result.error;

  return result.entries
    .filter((d) => d.isDirectory())
    .filter((d) => showHidden || !d.name.startsWith('.'))
    .filter((d) => !needle || d.name.toLowerCase().includes(needle))
    .map((d) => {
      const fullPath = path.join(dir, d.name);
      const hasChildren = hasChildDirs(fullPath);
      return {
        label: `${d.name}${hasChildren ? '/' : ''}`,
        rawLabel: d.name,
        path: fullPath,
        hasChildren,
      };
    })
    .sort((a, b) => a.rawLabel.localeCompare(b.rawLabel));
}

function hasChildDirs(dir) {
  const result = readDirSafe(dir);
  return result.entries.some((d) => d.isDirectory() && (showHidden || !d.name.startsWith('.')));
}

function loadEntries() {
  entries = [
    { label: '..', rawLabel: '..', path: path.dirname(cwd), hasChildren: hasChildDirs(path.dirname(cwd)) },
    { label: '.', rawLabel: '.', path: cwd, hasChildren: hasChildDirs(cwd) },
    ...dirEntries(cwd, true),
  ];

  if (selectedIndex >= entries.length) selectedIndex = Math.max(0, entries.length - 1);
  if (selectedIndex < 0) selectedIndex = 0;
  updatePreview();
  clampViewport();
}

function visibleHeight() {
  return Math.max(3, (process.stderr.rows || 24) - 5);
}

function clampViewport() {
  const h = visibleHeight();
  if (selectedIndex < viewportTop) viewportTop = selectedIndex;
  if (selectedIndex >= viewportTop + h) viewportTop = selectedIndex - h + 1;
  if (viewportTop < 0) viewportTop = 0;
  if (viewportTop > Math.max(0, entries.length - h)) viewportTop = Math.max(0, entries.length - h);
}

function clear() {
  process.stderr.write('\x1b[?25l');
  process.stderr.write('\x1b[2J\x1b[H');
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function fitAnsi(s, width) {
  const plain = stripAnsi(s);
  if (plain.length > width) return `${plain.slice(0, Math.max(0, width - 1))}…`;
  return s + ' '.repeat(width - plain.length);
}

function highlightFilter(entry) {
  if (!filter || entry.rawLabel === '.' || entry.rawLabel === '..') return entry.label;
  const lower = entry.rawLabel.toLowerCase();
  const needle = filter.toLowerCase();
  const at = lower.indexOf(needle);
  if (at < 0) return entry.label;

  const before = entry.rawLabel.slice(0, at);
  const hit = entry.rawLabel.slice(at, at + filter.length);
  const after = entry.rawLabel.slice(at + filter.length);
  return `${before}\x1b[90m${hit}\x1b[0m${after}${entry.hasChildren ? '/' : ''}`;
}

function updatePreview() {
  if (!previewMode) {
    preview = null;
    return;
  }

  const entry = entries[selectedIndex];
  preview = entry ? { path: entry.path, entries: dirEntries(entry.path, false) } : null;
}

function render() {
  clampViewport();
  clear();

  const h = visibleHeight();
  const shown = entries.slice(viewportTop, viewportTop + h);
  const cols = process.stderr.columns || 100;
  const leftWidth = preview ? Math.max(24, Math.floor(cols * 0.45)) : Math.max(24, cols - 2);
  const rightWidth = Math.max(20, cols - leftWidth - 4);

  process.stderr.write(`u-tree  path: ${cwd}\n\n`);

  if (helpMode) {
    process.stderr.write(`Keys\n\n`);
    process.stderr.write(`  ↑/↓          move selection\n`);
    process.stderr.write(`  type         filter folders, case-insensitive\n`);
    process.stderr.write(`  Backspace    edit filter; if empty, go up\n`);
    process.stderr.write(`  .            hide/show hidden folders\n`);
    process.stderr.write(`  Space        toggle preview mode\n`);
    process.stderr.write(`  Insert       add selected folder to shortcuts\n`);
    process.stderr.write(`  Home         show/hide shortcut list\n`);
    process.stderr.write(`  →            open selected folder\n`);
    process.stderr.write(`  ←            go up to parent folder\n`);
    process.stderr.write(`  Enter        cd to selected folder and exit\n`);
    process.stderr.write(`  Esc/q        quit\n\n`);
    process.stderr.write(`Shortcut list\n\n`);
    process.stderr.write(`  ↑/↓          move\n`);
    process.stderr.write(`  Enter        cd to shortcut and exit\n`);
    process.stderr.write(`  →            go to shortcut and stay in u-tree\n`);
    process.stderr.write(`  Delete       remove shortcut\n`);
    process.stderr.write(`  h            go to home and stay in u-tree\n`);
    process.stderr.write(`  1-9/0        go directly to numbered shortcut and stay in u-tree\n`);
    process.stderr.write(`  Home         return to tree\n\n`);
    process.stderr.write(`Legend\n\n`);
    process.stderr.write(`  /            folder has subfolders\n\n`);
    process.stderr.write(`Press ? to return\n`);
    return;
  }

  if (shortcutMode) {
    const list = shortcutItems();
    for (let i = 0; i < Math.min(h, list.length); i++) {
      const item = list[i];
      const label = `${item.key}  ${item.path}`;
      const line = `${i === shortcutIndex ? '▸ ' : '  '}${label}`;
      process.stderr.write(i === shortcutIndex ? `\x1b[7m${line}\x1b[0m\n` : `${line}\n`);
    }
    const shortcutKeys = ['? help', list.length > 1 ? '↑/↓ move' : '', 'h home', list.length > 1 ? '1-0 goto' : '', 'Enter cd', '→ goto', shortcutIndex > 0 ? 'Del remove' : '', 'Home/Esc back'].filter(Boolean).join('  ');
    process.stderr.write(`\n${shortcutKeys}\n`);
    return;
  }

  if (errorMessage) {
    process.stderr.write(`  ${errorMessage}\n`);
  } else if (entries.length === 0) {
    process.stderr.write('  (no folders)\n');
  } else {
    for (let i = 0; i < Math.max(shown.length, preview?.entries.length || 0, 1, h); i++) {
      if (i >= h) break;
      const realIndex = viewportTop + i;
      const item = shown[i];
      let left = '';

      if (item) {
        const prefix = realIndex === selectedIndex ? '▸ ' : '  ';
        const text = `${prefix}${highlightFilter(item)}`;
        left = fitAnsi(text, leftWidth);
        if (realIndex === selectedIndex) left = `\x1b[7m${left}\x1b[0m`;
      } else {
        left = ' '.repeat(leftWidth);
      }

      if (preview) {
        const p = preview.entries[i];
        const right = p ? fitAnsi(`  ${p.label}`, rightWidth) : ' '.repeat(rightWidth);
        process.stderr.write(`${left}  │${right}\n`);
      } else {
        process.stderr.write(`${left}\n`);
      }
    }
  }

  const moreTop = viewportTop > 0 ? '↑ more' : '';
  const moreBottom = viewportTop + h < entries.length ? '↓ more' : '';
  const more = [moreTop, moreBottom].filter(Boolean).join('  ');
  const selected = entries[selectedIndex];
  const keys = [
    '? help',
    entries.length > 1 ? '↑/↓ move' : '',
    'type filter',
    filter ? 'Backspace edit' : 'Backspace up',
    `. hidden ${showHidden ? 'shown' : 'hidden'}`,
    'Space preview',
    selected ? 'Ins shortcut' : '',
    'Home shortcuts',
    selected?.hasChildren ? '→ open' : '',
    '← up',
    'Enter cd',
    'Esc/q quit',
    more,
  ].filter(Boolean).join('  ');
  process.stderr.write(`\n${keys}\n`);
}

function cleanup() {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stderr.write('\x1b[?25h');
  process.stderr.write('\x1b[2J\x1b[H');
}

function quit(code = 0) {
  cleanup();
  process.exit(code);
}

function selectedPath() {
  return entries[selectedIndex]?.path || cwd;
}

function selectCurrent() {
  cleanup();
  process.stdout.write(selectedPath());
  process.exit(0);
}

function beep() {
  process.stderr.write('\x07');
}

function togglePreviewMode() {
  previewMode = !previewMode;
  saveConfig();
  updatePreview();
  render();
}

function openSelected() {
  const entry = entries[selectedIndex];
  if (!entry) return;
  if (!entry.hasChildren) {
    beep();
    return;
  }

  const result = readDirSafe(entry.path);
  if (result.error) {
    errorMessage = result.error;
    beep();
    render();
    return;
  }

  cwd = entry.path;
  selectedIndex = 1;
  viewportTop = 0;
  filter = '';
  loadEntries();
  render();
}

function goUp() {
  cwd = path.dirname(cwd);
  selectedIndex = 1;
  viewportTop = 0;
  filter = '';
  loadEntries();
  render();
}

function addShortcut() {
  const target = selectedPath();
  const list = shortcuts();
  if (!list.includes(target)) {
    list.push(target);
    list.sort((a, b) => a.localeCompare(b));
    saveConfig();
  }
  beep();
}

function showShortcuts() {
  shortcutMode = !shortcutMode;
  shortcutIndex = Math.min(shortcutIndex, Math.max(0, shortcutItems().length - 1));
  filter = '';
  preview = null;
  render();
}

function gotoShortcut(stayInTree, index = shortcutIndex) {
  const target = shortcutItems()[index]?.path;
  if (!target || !isDir(target)) {
    beep();
    return;
  }
  if (!stayInTree) {
    cleanup();
    process.stdout.write(target);
    process.exit(0);
  }
  cwd = target;
  selectedIndex = 1;
  viewportTop = 0;
  filter = '';
  shortcutMode = false;
  loadEntries();
  render();
}

function deleteShortcut() {
  if (shortcutIndex === 0) {
    beep();
    return;
  }
  const list = shortcuts();
  const storedIndex = shortcutIndex - 1;
  if (storedIndex < 0 || storedIndex >= list.length) return;
  list.splice(storedIndex, 1);
  shortcutIndex = Math.min(shortcutIndex, Math.max(0, shortcutItems().length - 1));
  saveConfig();
  render();
}

selectedIndex = 1;
loadEntries();

if (!process.stdin.isTTY) {
  console.error('u-tree: interactive terminal required');
  process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');
render();

process.stdin.on('data', (key) => {
  if (key === '\u0003') quit(130);
  if (key === '?') { helpMode = !helpMode; render(); return; }
  if (helpMode) {
    if (key === '\u001b' || key === 'q') { helpMode = false; render(); }
    return;
  }

  const isHome = key === '\u001b[H' || key === '\u001b[1~' || key === '\u001b[7~';
  const isDelete = key === '\u001b[3~';
  const isInsert = key === '\u001b[2~';

  if (shortcutMode) {
    const list = shortcutItems();
    if (key === '\u001b' || key === 'q') { shortcutMode = false; render(); return; }
    if (isHome) { showShortcuts(); return; }
    if (key === 'h') { gotoShortcut(true, 0); return; }
    if (/^[1-9]$/.test(key)) { gotoShortcut(true, Number(key)); return; }
    if (key === '0') { gotoShortcut(true, 10); return; }
    if (key === '\u001b[A') { shortcutIndex = Math.max(0, shortcutIndex - 1); render(); return; }
    if (key === '\u001b[B') { shortcutIndex = Math.min(Math.max(0, list.length - 1), shortcutIndex + 1); render(); return; }
    if (key === '\r' || key === '\n') { gotoShortcut(false); return; }
    if (key === '\u001b[C') { gotoShortcut(true); return; }
    if (isDelete) { deleteShortcut(); return; }
    return;
  }

  if (key === '\u001b' || (key === 'q' && !filter)) quit(0);

  if (isInsert) { addShortcut(); return; }
  if (isHome) { showShortcuts(); return; }

  if (key === '\u001b[A') {
    selectedIndex = Math.max(0, selectedIndex - 1);
    updatePreview();
    render();
    return;
  }
  if (key === '\u001b[B') {
    selectedIndex = Math.min(Math.max(0, entries.length - 1), selectedIndex + 1);
    updatePreview();
    render();
    return;
  }
  if (key === '\u001b[C') {
    openSelected();
    return;
  }
  if (key === ' ') {
    togglePreviewMode();
    return;
  }
  if (key === '\u001b[D') {
    goUp();
    return;
  }
  if (key === '\u007f') {
    if (filter) {
      filter = filter.slice(0, -1);
      selectedIndex = 1;
      viewportTop = 0;
      loadEntries();
      render();
    } else {
      goUp();
    }
    return;
  }
  if (key === '.') {
    showHidden = !showHidden;
    saveConfig();
    selectedIndex = 1;
    viewportTop = 0;
    loadEntries();
    render();
    return;
  }
  if (key === '\r' || key === '\n') {
    selectCurrent();
    return;
  }
  if (key.length === 1 && key >= ' ' && key !== '\u007f') {
    filter += key;
    selectedIndex = 1;
    viewportTop = 0;
    loadEntries();
    render();
  }
});
