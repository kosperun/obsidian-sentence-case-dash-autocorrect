import { Text } from '@codemirror/state';
import { isolateHistory } from '@codemirror/commands';
import { ViewPlugin, ViewUpdate } from '@codemirror/view';

import { findInsertedTerminator, findWordStart, isInsideCode, WORD_CHAR } from './capitalize';

export const EN_DASH = '–';
export const EM_DASH = '—';

export interface DashSettings {
	autocorrectDashes: boolean;
}

export const DEFAULT_DASH_SETTINGS: DashSettings = {
	autocorrectDashes: true,
};

export interface DashRun {
	from: number;
	to: number;
	spaceBefore: boolean;
	replacement: string;
}

/**
 * Looks for a run of one or two hyphens immediately before `wordStart`
 * (skipping a single space on each side, if present) and decides whether it
 * should become a dash. Mirrors Word's AutoFormat behavior:
 *   - "word--word" (no surrounding spaces) -> em dash, no spaces
 *   - "word - word" / "word -- word" (spaces on both sides) -> en dash, spaces kept
 *   - a single hyphen with no surrounding spaces ("well-known") is left alone
 * Returns null if there's nothing to convert.
 */
export function findDashRun(doc: Text, wordStart: number): DashRun | null {
	const line = doc.lineAt(wordStart);
	let pos = wordStart;

	let spaceBefore = false;
	if (pos > line.from && doc.sliceString(pos - 1, pos) === ' ') {
		spaceBefore = true;
		pos--;
	}

	let hyphenEnd = pos;
	let hyphenCount = 0;
	while (pos > line.from && doc.sliceString(pos - 1, pos) === '-') {
		pos--;
		hyphenCount++;
	}
	if (hyphenCount === 0 || hyphenCount > 2) return null;
	const hyphenStart = pos;

	let spaceAfter = false;
	if (hyphenStart > line.from && doc.sliceString(hyphenStart - 1, hyphenStart) === ' ') {
		spaceAfter = true;
		pos--;
	}

	// There must be a word character right before the (optional space and)
	// hyphen run, otherwise this isn't "word-word" but e.g. a list marker or
	// the start of a line.
	if (pos <= line.from) return null;
	if (!WORD_CHAR.test(doc.sliceString(pos - 1, pos))) return null;

	if (spaceBefore !== spaceAfter) return null; // spaces must match on both sides

	if (spaceBefore) {
		return { from: hyphenStart, to: hyphenEnd, spaceBefore: true, replacement: EN_DASH };
	}
	if (hyphenCount === 2) {
		return { from: hyphenStart, to: hyphenEnd, spaceBefore: false, replacement: EM_DASH };
	}
	return null; // single unspaced hyphen, e.g. "well-known": leave alone
}

export function makeAutocorrectDashesOnWordEnd(getSettings: () => DashSettings) {
	return ViewPlugin.fromClass(
		class {
			update(update: ViewUpdate) {
				if (!update.docChanged) return;
				if (!getSettings().autocorrectDashes) return;

				for (const tr of update.transactions) {
					if (!tr.docChanged) continue;
					if (tr.isUserEvent('undo') || tr.isUserEvent('redo') || tr.isUserEvent('input.paste')) continue;

					const found = findInsertedTerminator(tr);
					if (!found) continue;
					const { insertedFrom } = found;

					const doc = tr.newDoc;
					const wordStart = findWordStart(doc, insertedFrom);
					if (wordStart === insertedFrom) continue; // no word right before the terminator

					const dashRun = findDashRun(doc, wordStart);
					if (!dashRun) continue;
					if (isInsideCode(tr.state, dashRun.from)) continue;

					const original = doc.sliceString(dashRun.from, dashRun.to);

					const view = update.view;
					void Promise.resolve().then(() => {
						const state = view.state;
						if (dashRun.to > state.doc.length) return;
						if (state.sliceDoc(dashRun.from, dashRun.to) !== original) return;
						view.dispatch({
							changes: { from: dashRun.from, to: dashRun.to, insert: dashRun.replacement },
							annotations: isolateHistory.of('full'),
						});
					});
				}
			}
		}
	);
}
