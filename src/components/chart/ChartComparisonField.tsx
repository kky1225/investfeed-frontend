import {useEffect, useRef, useState} from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import type {ComparisonItem, ComparisonTarget} from "./useChartComparisons.ts";

export interface ChartComparisonFieldProps {
    items: ComparisonItem[],    // 더해 둔 비교 종목
    max: number,                // 더할 수 있는 최대 수
    selfCode?: string,          // 지금 보고 있는 종목. 검색 결과에서 뺀다
    onSearch: (keyword: string) => Promise<ComparisonTarget[]>,
    onAdd: (target: ComparisonTarget) => void,
    onRemove: (code: string) => void,
}

const SEARCH_DELAY_MS = 300;    // 입력이 멈추고 이만큼 지나면 검색한다
const SWATCH_SIZE = 12;

/** 설정 창의 종목 비교 칸: 종목을 검색해 더하고, 더해 둔 종목을 지운다. */
const ChartComparisonField = ({items, max, selfCode, onSearch, onAdd, onRemove}: ChartComparisonFieldProps) => {
    const [input, setInput] = useState('');
    const [options, setOptions] = useState<ComparisonTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const ticket = useRef(0);   // 가장 최근 검색의 번호. 늦게 도착한 앞선 검색의 결과는 버린다

    useEffect(() => () => clearTimeout(timer.current), []);

    const changeInput = (value: string) => {
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
            onSearch(keyword)
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

    // 보고 있는 종목과 이미 더한 종목은 고를 수 없게 뺀다.
    const excluded = [selfCode, ...items.map(item => item.code)];
    const choices = options.filter(option => !excluded.includes(option.code));

    return (
        <Box>
            {items.length < max ? (
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
                    renderInput={params => <TextField {...params} label="비교할 종목 검색"/>}
                />
            ) : (
                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                    비교 종목은 {max}개까지 더할 수 있습니다.
                </Typography>
            )}
            {items.length > 0 && (
                <Stack spacing={0.5} sx={{mt: 1}}>
                    {items.map(item => (
                        <Stack key={item.code} direction="row" spacing={1} sx={{alignItems: 'center'}}>
                            <Box
                                sx={{
                                    width: SWATCH_SIZE,
                                    height: SWATCH_SIZE,
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    backgroundColor: `var(--chart-line-${item.color + 1})`,
                                }}
                            />
                            <Typography variant="body2" noWrap sx={{flexGrow: 1, minWidth: 0}}>
                                {item.name}
                                <Typography component="span" variant="caption" sx={{color: 'text.secondary', ml: 1}}>
                                    {item.code}
                                </Typography>
                            </Typography>
                            <Tooltip title="비교에서 빼기">
                                <IconButton
                                    size="small"
                                    aria-label={`${item.name} 비교에서 빼기`}
                                    onClick={() => onRemove(item.code)}
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
        </Box>
    );
};

export default ChartComparisonField;
