import { foldable, foldEffect } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';

export function foldAllExceptRoot(view: EditorView) {
    const { state } = view;
    const effects = [];
    let rootSkipped = false;
    for (let pos = 0; pos < state.doc.length;) {
        const line = view.lineBlockAt(pos);
        const range = foldable(state, line.from, line.to);
        if (range) {
            if (!rootSkipped) {
                rootSkipped = true;
                pos = line.to + 1;
                continue;
            }
            effects.push(foldEffect.of(range));
            pos = view.lineBlockAt(range.to).to + 1;
        } else {
            pos = line.to + 1;
        }
    }
    if (effects.length) view.dispatch({ effects });
}
