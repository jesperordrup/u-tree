# u-tree

Interactive terminal directory navigator for fast `cd`.

`u-tree` lets you move through folders with arrow keys, filter by typing, preview subfolders, and jump to shortcuts.

## Compatibility

`u-tree` is a Node.js command-line tool for interactive terminals.

Currently intended for:

- Linux
- macOS
- Bash or Zsh shell integration
- Terminal emulators that support ANSI escape sequences and raw keyboard input

Requirements:

- Node.js 18+ recommended
- npm, for `npm link` during development

Notes:

- Windows is not tested yet.
- The raw CLI can run anywhere Node can run, but actual `cd` behavior requires a shell function in your current shell.

## Install from npm

After the package is published:

```bash
npm install -g u-tree
```

The GitHub release workflow publishes to npm when a GitHub release is published. The repo needs an `NPM_TOKEN` secret with publish permission.

## Install for development

From the repo folder, run:

```bash
npm link
```

`npm link` registers this local checkout as a global command on your machine.

This repo's `package.json` contains:

```json
"bin": {
  "u-tree": "bin/u-tree.js"
}
```

So `npm link` creates a global `u-tree` command that points directly to `bin/u-tree.js` in this folder. That means you can edit the source file and immediately test the latest version by running:

```bash
u-tree
```

No rebuild or reinstall is needed during development.

To remove the development link later:

```bash
npm unlink -g u-tree
```

## Shell setup

A command cannot directly change the parent shell directory, so add this function to `~/.bashrc` or `~/.zshrc`:

```bash
u-tree() {
  local dest
  dest="$(command u-tree "$@")" || return
  [ -n "$dest" ] && cd "$dest"
}

utree() {
  u-tree "$@"
}
```

Reload your shell:

```bash
source ~/.bashrc
# or
source ~/.zshrc
```

Then run:

```bash
u-tree
u-tree .
u-tree ~/Code
utree
```

## Options

`u-tree` remembers preview mode, hidden-folder mode, and shortcuts between sessions in:

```text
~/.config/u-tree/config.json
```

Override startup settings:

```bash
u-tree --preview
u-tree --no-preview
u-tree --hidden
u-tree --no-hidden
u-tree ~/Code --preview --no-hidden
```

## Keys

Press `?` inside `u-tree` to see available keys.

Common keys:

- `↑` / `↓`: move selection
- type text: filter folders by substring, case-insensitive
- `.`: hide/show hidden folders
- `Space`: toggle preview mode
- `Insert`: add selected folder to shortcuts
- `Home`: show/hide shortcut list
- `→`: open selected folder
- `←`: go up to parent folder
- `Enter`: cd to selected folder and exit
- `Esc` / `q`: quit, or return from help/shortcut screen

Shortcut list:

- Home is always listed first as `h`
- Stored shortcuts are numbered `1`-`9`, then `0`
- `h`: go to home and stay in `u-tree`
- `1`-`9` / `0`: go directly to numbered shortcut and stay in `u-tree`
- `Enter`: cd to selected shortcut and exit
- `→`: go to selected shortcut and stay in `u-tree`
- `Delete`: remove selected non-home shortcut

## Display

- `.` means current folder
- `..` means parent folder
- Folders ending in `/` have subfolders
- Folders without `/` have no subfolders
- Matching filter substring is shown in gray

## Development

Syntax check:

```bash
node --check bin/u-tree.js
```

## Contributing

Issues and pull requests are welcome.

If you find a bug, have an idea, or want a new keybinding/behavior, please open an issue:

```text
https://github.com/jesperordrup/u-tree/issues
```

Pull requests are also welcome. For code changes, please run:

```bash
node --check bin/u-tree.js
```

before submitting.

## License

MIT
