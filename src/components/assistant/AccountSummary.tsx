import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type {AccountBlock, AccountStat} from '../../type/AssistantType';
import ColoredText from './ColoredText';
import MarkdownBlock from './MarkdownBlock';

/** 메시지 카드 배경을 그대로 비치게 하는 테두리 박스. 흰 배경을 따로 깔지 않는다 */
const BOX_SX = {border: '1px solid', borderColor: 'divider', borderRadius: 2} as const;

/** 세로선으로 나눈 칸. 계좌 화면 요약 카드의 배치만 빌리고 글씨는 메시지 톤에 맞춘다 */
function StatRow({stats}: { stats: AccountStat[] }) {
    return (
        <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" divider={<Divider orientation="vertical" flexItem/>}>
            {stats.map((s) => (
                <Box key={s.label}>
                    <Typography sx={{fontSize: 12, color: 'text.secondary', lineHeight: 1.5}}>{s.label}</Typography>
                    <Typography sx={{fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums'}}>
                        <ColoredText text={s.value}/>
                    </Typography>
                </Box>
            ))}
        </Stack>
    );
}

/**
 * 개인 보유 섹션. 위는 총액 박스, 아래는 증권사별 박스.
 * 값 문자열과 색은 서버가 완성해서 보낸다.
 */
export default function AccountSummary({account}: { account: AccountBlock }) {
    return (
        <Stack spacing={1.25}>
            <Box sx={{...BOX_SX, px: 2, py: 1.5}}>
                <Typography sx={{fontSize: 12, color: 'text.secondary', lineHeight: 1.5}}>총 평가금액</Typography>
                <Typography sx={{fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', mb: account.stats.length > 0 ? 1.25 : 0}}>
                    {account.total}
                </Typography>
                {account.stats.length > 0 && (
                    <>
                        <Divider sx={{mb: 1.25}}/>
                        <StatRow stats={account.stats}/>
                    </>
                )}
            </Box>

            <Typography sx={{fontSize: 12, color: 'text.secondary'}}>증권사별</Typography>

            {account.brokers.map((b) => (
                <Box key={b.name} sx={{...BOX_SX, px: 2, py: 1.25}}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{mb: b.failed ? 0 : 1}}>
                        <Typography sx={{fontSize: 14, fontWeight: 600}}>{b.name}</Typography>
                        {b.failed
                            ? <Typography sx={{fontSize: 13, color: 'text.secondary'}}>조회 실패</Typography>
                            : <Typography sx={{fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums'}}>{b.total}</Typography>}
                    </Stack>
                    {!b.failed && b.stats.length > 0 && <Box sx={{mb: 1}}><StatRow stats={b.stats}/></Box>}
                    {!b.failed && b.table && <MarkdownBlock text={b.table}/>}
                </Box>
            ))}
        </Stack>
    );
}
