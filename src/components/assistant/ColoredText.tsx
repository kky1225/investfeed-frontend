import {Fragment} from 'react';
import {TREND_COLORS} from '../CustomRender';

const TOKEN = /^\{([^{}|]+)\|(up|down)\}$/;

/** 색 문법 `{값|up}` / `{값|down}` 을 색 span 으로. 마크다운 없이 한 줄 값에 쓴다 */
export default function ColoredText({text}: { text: string }) {
    return (
        <>
            {text.split(/(\{[^{}|]+\|(?:up|down)\})/g).map((part, i) => {
                const m = part.match(TOKEN);
                return m
                    ? <span key={i} style={{color: TREND_COLORS[m[2] as 'up' | 'down']}}>{m[1]}</span>
                    : <Fragment key={i}>{part}</Fragment>;
            })}
        </>
    );
}
