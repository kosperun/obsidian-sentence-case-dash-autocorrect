import { describe, expect, it } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, undo, redo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';

import { DEFAULT_DASH_SETTINGS, DashSettings, EM_DASH, EN_DASH, findDashRun, makeAutocorrectDashesOnWordEnd } from './dashes';

async function flush() {
	await Promise.resolve();
	await Promise.resolve();
}

function makeView(settings: Partial<DashSettings> = {}) {
	const merged = { ...DEFAULT_DASH_SETTINGS, ...settings };
	const view = new EditorView({
		state: EditorState.create({
			doc: '',
			extensions: [history(), markdown(), makeAutocorrectDashesOnWordEnd(() => merged)],
		}),
		parent: document.body,
	});
	return { view, settings: merged };
}

async function type(view: EditorView, text: string) {
	for (const ch of text) {
		const pos = view.state.doc.length;
		view.dispatch({
			changes: { from: pos, insert: ch },
			selection: EditorSelection.cursor(pos + 1),
			userEvent: 'input.type',
		});
		await flush();
	}
}

describe('findDashRun', () => {
	function docFor(text: string) {
		return EditorState.create({ doc: text }).doc;
	}

	it('converts an unspaced double hyphen to an em dash', () => {
		const doc = docFor('word--word');
		const run = findDashRun(doc, 6); // wordStart of the second "word"
		expect(run).toEqual({ from: 4, to: 6, spaceBefore: false, replacement: EM_DASH });
	});

	it('converts a spaced double hyphen to an en dash, keeping spaces', () => {
		const doc = docFor('word -- word');
		const run = findDashRun(doc, 8);
		expect(run).toEqual({ from: 5, to: 7, spaceBefore: true, replacement: EN_DASH });
	});

	it('converts a spaced single hyphen to an en dash, keeping spaces', () => {
		const doc = docFor('word - word');
		const run = findDashRun(doc, 7);
		expect(run).toEqual({ from: 5, to: 6, spaceBefore: true, replacement: EN_DASH });
	});

	it('leaves an unspaced single hyphen alone (compound word)', () => {
		const doc = docFor('well-known');
		const run = findDashRun(doc, 5);
		expect(run).toBeNull();
	});

	it('does nothing when there is no hyphen before the word', () => {
		const doc = docFor('hello world');
		const run = findDashRun(doc, 6);
		expect(run).toBeNull();
	});

	it('does nothing when spacing is mismatched on the two sides', () => {
		const doc = docFor('word- word'); // space only after
		const run = findDashRun(doc, 6);
		expect(run).toBeNull();
	});

	it('does nothing when there is no word character before the hyphen run', () => {
		const doc = docFor('--word');
		const run = findDashRun(doc, 2);
		expect(run).toBeNull();
	});
});

describe('makeAutocorrectDashesOnWordEnd (integration, real EditorView)', () => {
	it('does nothing when the setting is off', async () => {
		const { view } = makeView({ autocorrectDashes: false });
		await type(view, 'word--word ');
		expect(view.state.doc.toString()).toBe('word--word ');
	});

	it('converts an unspaced double hyphen to an em dash on space', async () => {
		const { view } = makeView({ autocorrectDashes: true });
		await type(view, 'word--word ');
		expect(view.state.doc.toString()).toBe(`word${EM_DASH}word `);
	});

	it('converts a spaced double hyphen to an en dash on space', async () => {
		const { view } = makeView({ autocorrectDashes: true });
		await type(view, 'word -- word ');
		expect(view.state.doc.toString()).toBe(`word ${EN_DASH} word `);
	});

	it('converts a spaced single hyphen to an en dash on space', async () => {
		const { view } = makeView({ autocorrectDashes: true });
		await type(view, 'word - word ');
		expect(view.state.doc.toString()).toBe(`word ${EN_DASH} word `);
	});

	it('leaves a compound word with an unspaced single hyphen alone', async () => {
		const { view } = makeView({ autocorrectDashes: true });
		await type(view, 'well-known ');
		expect(view.state.doc.toString()).toBe('well-known ');
	});

	it('does not convert inside a fenced code block', async () => {
		const { view } = makeView({ autocorrectDashes: true });
		await type(view, '```\n');
		await type(view, 'word--word ');
		expect(view.state.doc.toString()).toBe('```\nword--word ');
	});

	it('undo restores the original hyphens', async () => {
		const { view } = makeView({ autocorrectDashes: true });
		await type(view, 'word--word ');
		expect(view.state.doc.toString()).toBe(`word${EM_DASH}word `);

		undo(view);
		expect(view.state.doc.toString()).toBe('word--word ');
	});

	it('redo re-applies the dash conversion after undoing it', async () => {
		const { view } = makeView({ autocorrectDashes: true });
		await type(view, 'word--word ');
		expect(view.state.doc.toString()).toBe(`word${EM_DASH}word `);

		undo(view);
		redo(view);
		expect(view.state.doc.toString()).toBe(`word${EM_DASH}word `);
	});
});
