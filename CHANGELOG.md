# Changelog

All notable changes to `u-tree` will be documented in this file.

## [0.1.0] - 2026-06-11

### Added

- Initial interactive `u-tree` CLI.
- Directory navigation with arrow keys.
- `.` and `..` entries at the top of the folder list.
- Default selection on `.`.
- Type-to-filter folder list, case-insensitive.
- `.` key toggles hidden folders.
- Hidden-folder mode is remembered between sessions.
- Space toggles persistent preview mode.
- Preview mode shows selected folder's subfolders to the right.
- Preview mode is remembered between sessions.
- Insert adds selected folder to shortcuts.
- Home opens shortcut list.
- Home folder is always listed as shortcut `h`.
- Numbered shortcuts `1`-`9` and `0`.
- Shortcut deletion with Delete, except home shortcut.
- `?` help screen.
- Graceful permission-denied handling.
- Shell function workflow for actual `cd` behavior.
- Development documentation for `npm link`.
- Compatibility and contributing documentation.

### Notes

- `u-tree` is currently intended for Linux/macOS terminals with Node.js 18+.
- Windows is not tested yet.
