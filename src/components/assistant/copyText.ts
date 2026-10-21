import type {TurnCard} from '../../type/AssistantType';

const replyOf = (c: TurnCard): string | null => {
    const p = c.payload;
    return !!p && typeof p === 'object' && 'reply' in p && typeof (p as { reply: unknown }).reply === 'string' ? (p as { reply: string }).reply : null;
};

export function assistantCopyText(text: string | null | undefined, cards: TurnCard[], route?: string | null): string | null {
    if (cards.length === 0 || route === 'ERROR') return text?.trim() || null;
    const replies = cards.map(replyOf);
    if (replies.some((r) => r === null)) return null;
    return replies.join('\n');
}
