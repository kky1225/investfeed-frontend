import {useEffect, useRef, useState} from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import {
    COMPARISON_MARKET_LABELS, COMPARISON_MARKETS, ComparisonItem, ComparisonMarket, ComparisonTarget,
} from "./useChartComparisons.ts";

export interface ChartComparisonFieldProps {
    items: ComparisonItem[],    // 더해 둔 비교 종목
    max: number,                // 더할 수 있는 최대 수
    market: ComparisonMarket,   // 보고 있는 종목의 종류
    mixed: boolean,             // 지금 주기에서 다른 종류의 종목도 비교할 수 있는지 (일봉 이상)
    selfKey?: string,           // 지금 보고 있는 종목. 검색 결과에서 뺀다
    onSearch: (market: ComparisonMarket, keyword: string) => Promise<ComparisonTarget[]>,
    onAdd: (target: ComparisonTarget) => void,
    onRemove: (key: string) => void,
}

// 문장 안에서 종류를 가리키는 말
const MARKET_NOUNS: Record<ComparisonMarket, string> = {STOCK: '국내 종목', US_STOCK: '미국 종목', CRYPTO: '코인'};
const SEARCH_DELAY_MS = 300;   // 입력이 멈추고 이만큼 지나면 검색한다
const SWATCH_SIZE = 12;

/**
 * 설정 창의 종목 비교 칸: 종목을 검색해 더하고, 더해 둔 종목을 지운다.
 * 일봉 이상에서는 국내·미국·코인 중 어디서 찾을지 고르고, 분봉에서는 보고 있는 종목과 같은 종류에서만 찾는다.
 */
const ChartComparisonField = ({
    items, max, market, mixed, selfKey, onSearch, onAdd, onRemove,
}: ChartComparisonFieldProps) => {
    const [picked, setPicked] = useState<ComparisonMarket>(market);     // 고른 종류
    const searchMarket = mixed ? picked : market;
    const [input, setInput] = useState('');
    const [options, setOptions] = useState<ComparisonTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const ticket = useRef(0);   // 가장 최근 검색의 번호. 늦게 도착한 앞선 검색의 결과는 버린다

    useEffect(() => () => clearTimeout(timer.current), []);

    const searchFor = (value: string, target: ComparisonMarket) => {
        setInput(value);
        clearTimeout(timer.current);
        const current = ++ticket.current;
        const keyword = value.trim();
        if (!keyword) {
            setOptions([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        timer.current = setTimeout(() => {
            onSearch(target, keyword)
                .then(found => {
                    if (current === ticket.current) setOptions(found);
                })
                .catch(error => {
                    console.error(error);
                    if (current === ticket.current) setOptions([]);
                })
                .finally(() => {
                    if (current === ticket.current) setLoading(false);
                });
        }, SEARCH_DELAY_MS);
    };
    const changeInput = (value: string) => searchFor(value, searchMarket);


    // 보고 있는 종목과 이미 더한 종목은 고를 수 없게 뺀다.
    const excluded = [selfKey, ...items.map(item => item.key)];
    const choices = options.filter(option => !excluded.includes(`${option.market}:${option.code}`));
    const hiddenCount = items.filter(item => !item.shown).length;

    return (
        <Box>
            {items.length < max ? (
                <Stack spacing={1.5}>
                    {mixed && (
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={picked}
                            aria-label="비교할 종목의 종류"
                            onChange={(_event, next: ComparisonMarket | null) => {
                                if (!next) return;
                                setPicked(next);
                                // 다른 종류의 검색 결과가 남아 있지 않게 검색을 비운다.
                                searchFor('', next);
                            }}
                        >
                            {COMPARISON_MARKETS.map(item => (
                                <ToggleButton key={item} value={item} sx={{px: 2}}>
                                    {COMPARISON_MARKET_LABELS[item]}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    )}
                    <Autocomplete
                        size="small"
                        options={choices}
                        value={null}
                        inputValue={input}
                        onInputChange={(_event, value, reason) => {
                            // 종목을 고른 뒤 칸을 비우는 것은 아래 onChange 에서 직접 한다.
                            if (reason === 'input') changeInput(value);
                            else if (reason === 'clear') changeInput('');
                        }}
                        onChange={(_event, option) => {
                            if (!option) return;
                            onAdd(option);
                            changeInput('');
                        }}
                        getOptionLabel={option => `${option.name} (${option.code})`}
                        getOptionKey={option => option.code}
                        // 서버가 찾아 준 결과를 그대로 보여 준다.
                        filterOptions={found => found}
                        loading={loading}
                        loadingText="검색 중…"
                        noOptionsText={input.trim() ? '검색 결과가 없습니다.' : '종목 이름을 입력하세요.'}
                        blurOnSelect
                        renderInput={params => (
                            <TextField {...params} label={`비교할 ${MARKET_NOUNS[searchMarket]} 검색`}/>
                        )}
                    />
                </Stack>
            ) : (
                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                    비교 종목은 {max}개까지 더할 수 있습니다.
                </Typography>
            )}
            {items.length > 0 && (
                <Stack spacing={0.5} sx={{mt: 1}}>
                    {items.map(item => (
                        <Stack
                            key={item.key}
                            direction="row"
                            spacing={1}
                            // 지금 주기에서 그리지 않는 종목은 흐리게 보인다.
                            sx={{alignItems: 'center', color: item.shown ? 'text.primary' : 'text.disabled'}}
                        >
                            <Box
                                sx={{
                                    width: SWATCH_SIZE,
                                    height: SWATCH_SIZE,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    backgroundColor: `var(--chart-line-${item.color + 1})`,
                                    opacity: item.shown ? 1 : 0.4,
                                }}
                            />
                            <Typography variant="body2" noWrap sx={{flexGrow: 1, minWidth: 0}}>
                                {item.name}
                                <Typography component="span" variant="caption" sx={{color: 'text.secondary', ml: 1}}>
                                    {COMPARISON_MARKET_LABELS[item.market]} · {item.code}
                                    {!item.shown && ' · 분봉에서는 표시하지 않음'}
                                </Typography>
                            </Typography>
                            <Tooltip title="비교에서 빼기">
                                <IconButton
                                    size="small"
                                    aria-label={`${item.name} 비교에서 빼기`}
                                    onClick={() => onRemove(item.key)}
                                >
                                    <CloseIcon fontSize="inherit"/>
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    ))}
                </Stack>
            )}
            <Typography variant="body2" sx={{color: 'text.secondary', mt: 1}}>
                더한 종목은 차트에 선으로 겹쳐 그려집니다. 화면에 보이는 첫 캔들을 0%로 놓고 그 뒤의 등락률을 견주므로,
                비교하는 동안에는 가격축이 퍼센트 축이 됩니다. 비교 종목은 저장되지 않아 새로고침하면 사라집니다.
            </Typography>
            <Typography variant="body2" sx={{color: 'text.secondary', mt: 0.5}}>
                {mixed
                    ? '일봉·주봉·월봉·연봉에서는 국내 주식·미국 주식·코인을 섞어 비교할 수 있습니다.'
                    : `분봉에서는 거래 시간이 같은 ${MARKET_NOUNS[market]}끼리만 비교할 수 있습니다.`}
                {hiddenCount > 0 && ' 다른 종류의 종목은 일봉 이상으로 바꾸면 다시 표시됩니다.'}
            </Typography>
        </Box>
    );
};

export default ChartComparisonField;
