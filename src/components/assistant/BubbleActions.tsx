import {useEffect, useRef, useState} from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

const actionSx = {fontSize: 12, color: 'text.disabled', borderRadius: 1, px: 0.5, '&:hover': {color: 'text.primary'}};

async function writeClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // 아래 대체 방법으로
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
}

/** 복사 버튼. 누르면 잠깐 "복사됨"으로 바뀐다 */
export function CopyAction({text}: { text: string }) {
    const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    const copy = async () => {
        setState(await writeClipboard(text) ? 'done' : 'failed');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState('idle'), 1500);
    };
    return (
        <ButtonBase onClick={copy} sx={actionSx}>
            {state === 'done'
                ? <><CheckIcon sx={{fontSize: 14, mr: 0.25}}/>복사됨</>
                : <><ContentCopyIcon sx={{fontSize: 13, mr: 0.25}}/>{state === 'failed' ? '복사 실패' : '복사'}</>}
        </ButtonBase>
    );
}
