import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {renderChangeAmount, renderChip} from './CustomRender';
import {sessionChangeRate} from '../lib/usSession';

export default function UsSessionChange({label, price, regularClose}: {
    label: string;
    price: number | null | undefined;
    regularClose: number | null | undefined;
}) {
    const rate = sessionChangeRate(price, regularClose);
    if (rate === null || !price || !regularClose) return null;
    return (
        <Stack direction="row" sx={{alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5}}>
            <Typography variant="body2" sx={{fontWeight: 600}}>{label}</Typography>
            {renderChangeAmount(price - regularClose, '달러')}
            {renderChip(rate.toFixed(2))}
        </Stack>
    );
}
