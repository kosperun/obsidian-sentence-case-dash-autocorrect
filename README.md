# Sentence Case & Dash Autocorrect

An Obsidian plugin that fixes a few specific annoyances Word and LibreOffice handle but Obsidian doesn't:
1. Capitalize first letter of every sentence when you forget to press Shift.
2. Correct TWo INitial CApitals.
3. Replace dashes with en- or em-dashes.

I tried a couple of existing autocorrect plugins first, but each rescanned the whole line on every keystroke thus fighting you by re-capitalizing letters you deliberately typed lowercase, undo didn't cleanly revert just the auto-capitalization, and also did more than these specific fixes, so this plugin exists to do exactly these little things correctly.

When you finish typing a word — by pressing space, a punctuation mark, or Enter — its first letter is capitalized if that word starts a sentence. This mirrors Word/LibreOffice: nothing happens while you're still composing the word, so you're always free to type a deliberate lowercase letter there, correction only happens once, on the word-ending keystroke.

A single `Cmd/Ctrl+Z` right after correction undoes just it, without touching the rest of the word or the space/punctuation after it.

## What counts as "start of a sentence"

- The very start of the note
- The very start of a line
- Right after `.`, `!`, or `?` (optionally followed by closing quotes/brackets) and whitespace
- Right after a blockquote marker (`>`, `>>`, ...)
- Right after a list marker (`-`, `*`, `+`, `1.`, `1)`, including `- [ ]` checkboxes) — **off by default**, enable "Capitalize list items" in the plugin's settings

Code blocks and inline code spans are never touched, detected via Obsidian's own syntax tree rather than pattern-matching.

## Fix two initial capitals

Mirrors Word/LibreOffice's "Correct TWo INitial CApitals": if a word starts with two capital letters followed by a lowercase letter (like `THe` or `ABout`), the second letter is lowercased once you finish typing the word, on the same word-ending keystroke as sentence capitalization.

You can list exact words to always skip in the plugin's settings ("Two initial capitals exceptions"), comma-separated, case-sensitive.

## Autocorrect dashes

Converts hyphens into en or em dashes once you finish typing the word after them, mirroring Word/LibreOffice's dash autoformat:

- `word--word` (no spaces) => `word—word` (em dash)
- `word - word` or `word -- word` (spaces on both sides) => `word – word` (en dash, spaces kept)
- A single hyphen with no surrounding spaces, like `well-known`, is always left alone.

## Install (manual)

```
npm install --legacy-peer-deps
npm run build
```

(`--legacy-peer-deps` is needed because the `obsidian` types package pins an exact peer version of `@codemirror/state` that's older than what
`@codemirror/commands` requires, a dev-tooling-only conflict; Obsidian itself supplies one consistent set of CodeMirror packages at runtime.)

Copy `manifest.json` and `main.js` into `<vault>/.obsidian/plugins/sentence-capitalizer/`, then enable the plugin in Obsidian's Community Plugins settings.

## Tests

```
npm run test
```

Runs against a real CodeMirror `EditorState`/`EditorView` (jsdom), simulating actual keystroke-by-keystroke typing, Enter, and undo/redo, not just the pure decision logic in isolation, since most of the interesting bugs here were in how transactions and history interact.
