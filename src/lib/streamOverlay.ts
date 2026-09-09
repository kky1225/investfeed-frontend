export function mergeLive<S, T extends object>(
    prev: Map<string, T>,
    buffer: Map<string, S>,
    toValue: (value: S, prevValue: T | undefined) => T,
): Map<string, T> {
    let next: Map<string, T> | null = null;

    buffer.forEach((value, key) => {
        const prevValue = prev.get(key);
        const nextValue = toValue(value, prevValue);

        if (prevValue !== undefined && shallowEqual(prevValue, nextValue)) return;

        next ??= new Map(prev);
        next.set(key, nextValue);
    });

    return next ?? prev;
}

function shallowEqual(a: object, b: object): boolean {
    if (a === b) return true;

    const aKeys = Object.keys(a) as (keyof typeof a)[];
    if (aKeys.length !== Object.keys(b).length) return false;

    return aKeys.every(key => a[key] === b[key as keyof typeof b]);
}
