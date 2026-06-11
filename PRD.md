# PRD: `u-tree` Interactive Directory Navigator

## Summary

`u-tree` is a single-mode interactive CLI for navigating directories with the keyboard. It renders `..`, `.`, and child folders, lets the user move with arrows, and prints the selected absolute path on Enter. A shell function captures that path and runs `cd`, because a child CLI process cannot directly change the parent shell's current directory.

## Usage

```bash
u-tree
u-tree .
u-tree ~/Code
```

Recommended shell function:

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

## Requirements

- One interactive mode only.
- Start at current directory by default.
- Accept optional start path.
- Render:
  - `../`
  - `./`
  - all child folders
- Do not use an ignore list; show all directories.
- Typing filters child folders by substring, ignoring upper/lowercase.
- Changing folder clears the filter.
- First item is selected by default.
- UI output goes to stderr.
- Selected path goes to stdout only when Enter is pressed.
- Escape/q/Ctrl+C exits without output.

## Keys

| Key | Behavior |
|---|---|
| Typing text | Filter child folders by substring, case-insensitive |
| Backspace | Remove one filter character; if filter is empty, go to parent folder |
| Up | Move selection up |
| Down | Move selection down |
| Right / Space | Open selected folder and clear filter |
| Left | Go to parent folder and clear filter |
| Enter | Print selected folder path and exit |
| Esc / `q` when filter is empty / Ctrl+C | Quit without changing folder |

## Technical Plan

Use a small Node.js CLI with built-ins only:

- `fs.readdirSync()` for directories
- `path.resolve()` for paths
- `stdin.setRawMode(true)` for key input
- ANSI escape codes for rendering

Files:

```text
package.json
bin/u-tree.js
README.md
```

## Acceptance Criteria

- `npm link` exposes `u-tree`.
- `u-tree` opens the interactive navigator.
- `u-tree .` starts at the current directory.
- The list includes `..`, `.`, and all child directories.
- Arrow up/down changes selection.
- Arrow right/space enters selected directory.
- Arrow left/backspace goes to parent.
- Enter prints exactly one absolute path to stdout.
- Escape/q exits without stdout output.
- README explains shell integration for actual `cd` behavior.
