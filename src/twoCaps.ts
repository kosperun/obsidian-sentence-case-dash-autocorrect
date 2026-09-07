import { isolateHistory } from '@codemirror/commands';
import { ViewPlugin, ViewUpdate } from '@codemirror/view';

import { findInsertedTerminator, findWordStart, isInsideCode } from './capitalize';

// Matches Word's "Correct TWo INitial CApitals": two uppercase letters
// followed by a lowercase letter, e.g. "THe", "ABout". Words that are all
// caps (no lowercase letter after) are never touched, since those are
// presumed acronyms.
export const TWO_INITIAL_CAPS = /^\p{Lu}\p{Lu}\p{Ll}/u;

export interface TwoCapsSettings {
	fixTwoInitialCaps: boolean;
	// Exact, case-sensitive words to never touch (e.g. "IDs", "CDs", "TVs").
	twoCapsExceptions: string[];
}

export const DEFAULT_TWO_CAPS_SETTINGS: TwoCapsSettings = {
	fixTwoInitialCaps: true,
	twoCapsExceptions: [],
};

/**
 * Given a just-completed word, returns the fixed word if it should be
 * corrected (two initial caps followed by a lowercase letter, and not in the
 * exceptions list), or null if it should be left alone.
 */
export function fixTwoInitialCaps(word: string, settings: TwoCapsSettings): string | null {
	if (!TWO_INITIAL_CAPS.test(word)) return null;
	if (settings.twoCapsExceptions.includes(word)) return null;
	return word.slice(0, 1) + word.slice(1, 2).toLowerCase() + word.slice(2);
}

export function makeFixTwoInitialCapsOnWordEnd(getSettings: () => TwoCapsSettings) {
	return ViewPlugin.fromClass(
		class {
			update(update: ViewUpdate) {
				if (!update.docChanged) return;

				for (const tr of update.transactions) {
					if (!tr.docChanged) continue;
					if (tr.isUserEvent('undo') || tr.isUserEvent('redo') || tr.isUserEvent('input.paste')) continue;

					const found = findInsertedTerminator(tr);
					if (!found) continue;
					const { insertedFrom } = found;

					const doc = tr.newDoc;
					const wordStart = findWordStart(doc, insertedFrom);
					const wordEnd = insertedFrom;

					if (wordStart === wordEnd) continue; // no word immediately before the terminator
					if (isInsideCode(tr.state, wordStart)) continue;

					const settings = getSettings();
					if (!settings.fixTwoInitialCaps) continue;

					const word = doc.sliceString(wordStart, wordEnd);
					const fixed = fixTwoInitialCaps(word, settings);
					if (fixed === null || fixed === word) continue;

					const view = update.view;
					void Promise.resolve().then(() => {
						const state = view.state;
						if (wordEnd > state.doc.length) return;
						if (state.sliceDoc(wordStart, wordEnd) !== word) return;
						view.dispatch({
							changes: { from: wordStart, to: wordEnd, insert: fixed },
							annotations: isolateHistory.of('full'),
						});
					});
				}
			}
		}
	);
}
