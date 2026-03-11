import Chip from "@mui/material/Chip";

export function renderTradeColor(trade: number) {
    const text = trade.toLocaleString()

    return (
        <span style={{color: trade == 0 ? 'black' : trade > 0 ? 'red' : 'blue'}}>
            {trade > 0 ? `+${text}` : `${text}`}
        </span>
    )
}

export function renderInfo(trade: number) {
    return (
        <span style={{color: 'black'}}>
            {trade.toLocaleString()}
        </span>
    );
}

export function renderPercent(trade: number) {
    return (
        <span style={{color: 'black'}}>
            {`${trade}%`}
        </span>
    );
}

export function renderTradePricaColor(trade: string) {
    const value = Number(trade.slice(0, -1)) / 10;
    const formatted = value.toLocaleString('ko-KR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

    return (
        <span style={{color: value == 0 ? 'black' : value > 0 ? 'red' : 'blue'}}>
            {value > 0 ? `+${formatted}억` : `${formatted}억`}
        </span>
    )
}

export function renderChip (status: number) {
    const colors = status == 0 ? 'default' : status > 0 ? 'error': 'info';

    return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
}