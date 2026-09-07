import { describe, expect, it } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, undo, redo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';

import { DEFAULT_TWO_CAPS_SETTINGS, TwoCapsSettings, fixTwoInitialCaps, makeFixTwoInitialCapsOnWordEnd } from './twoCaps';

async function flush() {
	await Promise.resolve();
	await Promise.resolve();
}

function makeView(settings: Partial<TwoCapsSettings> = {}) {
	const merged = { ...DEFAULT_TWO_CAPS_SETTINGS, ...settings };
	const view = new EditorView({
		state: EditorState.create({
			doc: '',
			extensions: [history(), markdown(), makeFixTwoInitialCapsOnWordEnd(() => merged)],
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

describe('fixTwoInitialCaps', () => {
	const settingsOff: TwoCapsSettings = { fixTwoInitialCaps: false, twoCapsExceptions: [] };

	it('fixes a word with two initial caps followed by lowercase', () => {
		expect(fixTwoInitialCaps('THe', settingsOff)).toBe('The');
		expect(fixTwoInitialCaps('ABout', settingsOff)).toBe('About');
	});

	it('leaves all-caps words alone (no trailing lowercase)', () => {
		expect(fixTwoInitialCaps('NASA', settingsOff)).toBeNull();
		expect(fixTwoInitialCaps('USA', settingsOff)).toBeNull();
	});

	it('leaves words with only one initial cap alone', () => {
		expect(fixTwoInitialCaps('The', settingsOff)).toBeNull();
		expect(fixTwoInitialCaps('the', settingsOff)).toBeNull();
	});

	it('respects the exceptions list with an exact, case-sensitive match', () => {
		const settings: TwoCapsSettings = { fixTwoInitialCaps: false, twoCapsExceptions: ['IDs'] };
		expect(fixTwoInitialCaps('IDs', settings)).toBeNull();
		expect(fixTwoInitialCaps('IDed', settings)).toBe('Ided'); // not an exact match, still fixed
	});
});

describe('makeFixTwoInitialCapsOnWordEnd (integration, real EditorView)', () => {
	it('does nothing when the setting is off', async () => {
		const { view } = makeView({ fixTwoInitialCaps: false });
		await type(view, 'THe ');
		expect(view.state.doc.toString()).toBe('THe ');
	});

	it('fixes two initial caps on space when the setting is on', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true });
		await type(view, 'THe ');
		expect(view.state.doc.toString()).toBe('The ');
	});

	it('fixes on Enter without a trailing space', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true });
		await type(view, 'ABout');
		view.dispatch({
			changes: { from: view.state.doc.length, insert: '\n' },
			selection: EditorSelection.cursor(view.state.doc.length + 1),
			userEvent: 'input.type',
		});
		await flush();
		expect(view.state.doc.toString()).toBe('About\n');
	});

	it('leaves an all-caps word alone', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true });
		await type(view, 'NASA ');
		expect(view.state.doc.toString()).toBe('NASA ');
	});

	it('respects a configured exception', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true, twoCapsExceptions: ['IDs'] });
		await type(view, 'IDs ');
		expect(view.state.doc.toString()).toBe('IDs ');
	});

	it('does not touch a word mid-composition', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true });
		view.dispatch({ changes: { from: 0, insert: 'TH' }, userEvent: 'input.type' });
		await flush();
		expect(view.state.doc.toString()).toBe('TH');
	});

	it('does not fix inside a fenced code block', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true });
		await type(view, '```\n');
		await type(view, 'THe ');
		expect(view.state.doc.toString()).toBe('```\nTHe ');
	});

	it('undo restores the original word', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true });
		await type(view, 'THe ');
		expect(view.state.doc.toString()).toBe('The ');

		undo(view);
		expect(view.state.doc.toString()).toBe('THe ');
	});

	it('redo re-applies the fix after undoing it', async () => {
		const { view } = makeView({ fixTwoInitialCaps: true });
		await type(view, 'THe ');
		expect(view.state.doc.toString()).toBe('The ');

		undo(view);
		redo(view);
		expect(view.state.doc.toString()).toBe('The ');
	});
});
