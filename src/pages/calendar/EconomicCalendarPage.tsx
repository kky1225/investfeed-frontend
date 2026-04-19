import {useEffect, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Popover from "@mui/material/Popover";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import {fetchCalendarEvents, fetchEconomicIndicators, fetchIndicatorHistory} from "../../api/calendar/EconomicCalendarApi.ts";
import type {CalendarEvent, EconomicIndicator, IndicatorHistoryRes} from "../../type/EconomicCalendarType.ts";
import {LineChart} from "@mui/x-charts/LineChart";
import {useTheme} from "@mui/material/styles";

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function EconomicCalendarPage() {
    const theme = useTheme();
    const now = new Date();
    // 지표 값 + 단위 포맷: 숫자는 toLocaleString, 단위는 short suffix
    const formatIndicatorValue = (rawValue: string | number, unit: string): string => {
        const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (isNaN(num)) return String(rawValue);
        const localized = num.toLocaleString();
        if (unit === '%') return `${localized}%`;
        if (unit === '천 명') return `${localized}K`;
        if (unit === '원' || unit === '건') return `${localized}${unit}`;
        if (!unit) return localized;
        return `${localized} ${unit}`;
    };

    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [indicators, setIndicators] = useState<EconomicIndicator[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [selectedIndicator, setSelectedIndicator] = useState<EconomicIndicator | null>(null);
    const [history, setHistory] = useState<IndicatorHistoryRes | null>(null);
    const [chartLoading, setChartLoading] = useState(false);
    const [popoverAnchor, setPopoverAnchor] = useState<null | HTMLElement>(null);
    const [popoverEvents, setPopoverEvents] = useState<CalendarEvent[]>([]);
    const [popoverDate, setPopoverDate] = useState('');

    const loadData = async (y: number, m: number) => {
        setLoading(true);
        try {
            const [eventsRes, indicatorsRes] = await Promise.all([
                fetchCalendarEvents({year: y, month: m}),
                fetchEconomicIndicators(),
            ]);
            setEvents(eventsRes.result?.events ?? []);
            setIndicators(indicatorsRes.result?.indicators ?? []);
            setLastUpdated(eventsRes.result?.lastUpdated ?? null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(year, month);
    }, [year, month]);

    const handlePrevMonth = () => {
        if (month === 1) { setYear(year - 1); setMonth(12); }
        else setMonth(month - 1);
    };

    const handleNextMonth = () => {
        if (month === 12) { setYear(year + 1); setMonth(1); }
        else setMonth(month + 1);
    };

    const handleIndicatorClick = async (indicator: EconomicIndicator) => {
        if (selectedIndicator?.code === indicator.code) {
            setSelectedIndicator(null);
            setHistory(null);
            return;
        }
        setSelectedIndicator(indicator);
        setChartLoading(true);
        try {
            const res = await fetchIndicatorHistory({code: indicator.code, country: indicator.country});
            if (res.result) setHistory(res.result);
        } catch (err) {
            console.error(err);
        } finally {
            setChartLoading(false);
        }
    };

    // 달력 생성
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    const getEventsForDay = (day: number): CalendarEvent[] => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return events.filter(e => e.date === dateStr);
    };

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isStepChart = history?.chartType === 'stepAfter';

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                경제 캘린더
            </Typography>

            {lastUpdated && !loading && (
                <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 1}}>
                    <Typography variant="caption" color="text.secondary">
                        {new Date(lastUpdated).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} 기준
                    </Typography>
                </Box>
            )}

            {/* 주요 지표 카드 */}
            {(['KR', 'US'] as const).map((country) => {
                const countryIndicators = indicators.filter(i => i.country === country);
                if (countryIndicators.length === 0) return null;
                return (
                    <Box key={country} sx={{mb: 2}}>
                        <Typography variant="caption" sx={{fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5}}>
                            {country === 'KR' ? '🇰🇷 한국' : '🇺🇸 미국'}
                        </Typography>
                        <Grid container spacing={1.5}>
                            {countryIndicators.map((indicator) => {
                                const isSelected = selectedIndicator?.code === indicator.code;
                                const hasPrev = indicator.previousValue != null && indicator.previousValue !== '';
                                const changeNum = indicator.change ? Number(indicator.change.replace(/[^0-9.+-]/g, '')) : 0;
                                const changeColor = changeNum > 0 ? 'error.main' : changeNum < 0 ? 'info.main' : 'text.primary';

                                return (
                                    <Grid key={`${indicator.country}-${indicator.code}`} size={{xs: 6, sm: 4, md: 2.4}}>
                                        <Card variant="outlined" onClick={() => handleIndicatorClick(indicator)}
                                            sx={{cursor: 'pointer', '&:hover': {bgcolor: 'action.hover'},
                                                border: isSelected ? '2px solid' : '1px solid', borderColor: isSelected ? 'primary.main' : 'divider'}}>
                                            <CardContent sx={{pb: '8px !important', p: 1.5}}>
                                                <Typography variant="caption" color="text.secondary" noWrap sx={{mb: 0.5, display: 'block'}}>{indicator.name}</Typography>
                                                <Typography variant="body1" sx={{fontWeight: 700}}>
                                                    {formatIndicatorValue(indicator.latestValue, indicator.unit)}
                                                </Typography>
                                                {hasPrev ? (
                                                    <Typography variant="caption" sx={{color: 'text.secondary', fontWeight: 500}}>
                                                        이전 {formatIndicatorValue(indicator.previousValue!, indicator.unit)}
                                                    </Typography>
                                                ) : indicator.change && (
                                                    <Typography variant="caption" sx={{color: changeColor, fontWeight: 600}}>
                                                        {indicator.change}
                                                    </Typography>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                );
            })}

            {/* 차트 */}
            {selectedIndicator && (
                <Card variant="outlined" sx={{mb: 3}}>
                    <CardContent>
                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                            <Chip label={selectedIndicator.country === 'KR' ? '한국' : '미국'} size="small" variant="outlined"/>
                            <Typography variant="body1" sx={{fontWeight: 600}}>{selectedIndicator.name}</Typography>
                            <Typography variant="caption" color="text.secondary">({selectedIndicator.unit})</Typography>
                        </Box>
                        {chartLoading ? (
                            <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}><CircularProgress size={24}/></Box>
                        ) : history && history.data.length > 0 ? (
                            <Box sx={{overflowX: 'auto'}}>
                                <Box sx={{minWidth: 600, height: 300}}>
                                    <LineChart
                                        xAxis={[{data: history.data.map((_, i) => i), tickLabelStyle: {fontSize: 11}, valueFormatter: (i: number, ctx) => {
                                            const point = history.data[i];
                                            const date = point?.date ?? '';
                                            const obsDate = point?.observationDate ?? null;
                                            const freq = history.frequency;
                                            // 분기 데이터 포맷: "2024Q1" 또는 "2025-01-01" → 25Q1 / 2025 Q1
                                            const toQuarter = (d: string, full: boolean) => {
                                                const yy = d.substring(0, 4);
                                                let q = '?';
                                                if (d.length >= 6 && d.charAt(4) === 'Q') {
                                                    q = d.charAt(5);
                                                } else {
                                                    const mm = d.includes('-') ? d.substring(5, 7) : d.substring(4, 6);
                                                    q = { '01': '1', '04': '2', '07': '3', '10': '4' }[mm] ?? '?';
                                                }
                                                return full ? `${yy} Q${q}` : `${yy.substring(2)}Q${q}`;
                                            };
                                            // 관측월 라벨: "2025-10-01" → "25.10월분"
                                            const toObsLabel = (d: string) => `${d.substring(2, 4)}.${d.substring(5, 7)}월분`;
                                            // 같은 발표일 중복 여부
                                            const hasDup = i > 0 && history.data[i - 1]?.date === date || i < history.data.length - 1 && history.data[i + 1]?.date === date;

                                            if (ctx.location === 'tooltip') {
                                                if (freq === 'Q') return toQuarter(date, true);
                                                const dateStr = date.length >= 8 && !date.includes('-')
                                                    ? date.substring(0, 4) + '.' + date.substring(4, 6) + '.' + date.substring(6, 8)
                                                    : date.includes('-') ? date.replaceAll('-', '.') : date;
                                                if (obsDate) return `${obsDate.substring(0, 7)} (발표 ${dateStr})`;
                                                return dateStr;
                                            }
                                            // x축 라벨
                                            if (freq === 'Q') return toQuarter(date, false);
                                            // 발표일 중복 케이스: 관측월 라벨로 구분
                                            if (hasDup && obsDate) return toObsLabel(obsDate);
                                            if (history.data.length > 100) {
                                                const mm = date.includes('-') ? date.substring(5, 7) : date.substring(4, 6);
                                                const dd = date.includes('-') ? date.substring(8, 10) : date.substring(6, 8);
                                                if (mm === '01' && dd <= '03') {
                                                    const yyyy = date.substring(0, 4);
                                                    return yyyy + '.01';
                                                }
                                                return '';
                                            } else {
                                                if (date.length >= 6 && !date.includes('-')) return date.substring(2, 4) + '.' + date.substring(4, 6);
                                                if (date.length >= 7 && date.includes('-')) return date.substring(2, 4) + '.' + date.substring(5, 7);
                                            }
                                            return date;
                                        }, scaleType: 'point'}]}
                                        yAxis={[(() => {
                                            const values = history.data.map(d => Number(d.value) || 0);
                                            const min = Math.min(...values);
                                            const max = Math.max(...values);
                                            return {min, max};
                                        })()]}
                                        series={[{
                                            data: history.data.map(d => Number(d.value) || 0),
                                            showMark: isStepChart,
                                            curve: isStepChart ? 'stepAfter' : 'linear',
                                            area: true,
                                            color: theme.palette.primary.main,
                                            valueFormatter: (v, ctx) => {
                                                if (v == null) return '';
                                                const main = formatIndicatorValue(v, history.unit);
                                                const idx = ctx?.dataIndex;
                                                const original = idx != null ? history.data[idx]?.originalValue : null;
                                                if (original != null) {
                                                    return `${main} (원본 ${formatIndicatorValue(original, history.unit)})`;
                                                }
                                                return main;
                                            },
                                        }]}
                                        height={300}
                                    />
                                </Box>
                            </Box>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{py: 2, textAlign: 'center'}}>데이터가 없습니다.</Typography>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 캘린더 */}
            <Card variant="outlined">
                <CardContent>
                    <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 2}}>
                        <IconButton onClick={handlePrevMonth}><ChevronLeftIcon/></IconButton>
                        <Select size="small" value={year} onChange={e => setYear(Number(e.target.value))} sx={{fontWeight: 700}}>
                            {Array.from({length: 10}, (_, i) => now.getFullYear() - 5 + i).map(y => (
                                <MenuItem key={y} value={y}>{y}년</MenuItem>
                            ))}
                        </Select>
                        <Select size="small" value={month} onChange={e => setMonth(Number(e.target.value))} sx={{fontWeight: 700}}>
                            {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                                <MenuItem key={m} value={m}>{m}월</MenuItem>
                            ))}
                        </Select>
                        <IconButton onClick={handleNextMonth}><ChevronRightIcon/></IconButton>
                    </Box>

                    {loading ? (
                        <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}><CircularProgress size={24}/></Box>
                    ) : (
                        <>
                            <Grid container columns={7}>
                                {WEEKDAYS.map((day) => (
                                    <Grid key={day} size={1}>
                                        <Box sx={{textAlign: 'center', py: 1}}>
                                            <Typography variant="caption" sx={{fontWeight: 600, color: day === '일' ? 'error.main' : day === '토' ? 'info.main' : 'text.secondary'}}>
                                                {day}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>

                            <Grid container columns={7}>
                                {calendarDays.map((day, index) => {
                                    if (day === null) return <Grid key={`empty-${index}`} size={1}/>;

                                    const dayEvents = getEventsForDay(day);
                                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const isToday = dateStr === todayStr;
                                    const dayOfWeek = new Date(year, month - 1, day).getDay();
                                    const hasHoliday = dayEvents.some(e => e.type === 'HOLIDAY');

                                    return (
                                        <Grid key={day} size={1}>
                                            <Box sx={{
                                                minHeight: 120, p: 0.5, border: '1px solid', borderColor: 'divider',
                                                bgcolor: isToday ? 'action.selected' : 'background.paper',
                                                cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                                            }} onClick={(e) => { if (dayEvents.length > 0) { setPopoverAnchor(e.currentTarget); setPopoverEvents(dayEvents); setPopoverDate(dateStr); } }}>
                                                {(() => {
                                                    const holidays = dayEvents.filter(e => e.type === 'HOLIDAY');
                                                    const indicatorEvents = dayEvents.filter(e => e.type !== 'HOLIDAY');
                                                    return (<>
                                                        <Typography variant="caption" component="span" sx={{
                                                            fontWeight: isToday ? 700 : 400,
                                                            color: isToday ? '#fff' : (dayOfWeek === 0 || hasHoliday) ? 'error.main' : dayOfWeek === 6 ? 'info.main' : 'text.primary',
                                                            ...(isToday && {
                                                                bgcolor: 'primary.main', borderRadius: '50%',
                                                                width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            }),
                                                        }}>
                                                            {day}
                                                        </Typography>
                                                        <Box>
                                                            {holidays.map((h, i) => (
                                                                <Typography key={`h-${i}`} sx={{fontSize: 10, color: 'error.main', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                                    {h.name}
                                                                </Typography>
                                                            ))}
                                                            {indicatorEvents.length > 0 && <Box sx={{mt: 0.5}}/>}
                                                            {indicatorEvents.slice(0, 3).map((event, i) => (
                                                                <Box key={i} sx={{
                                                                    mb: 0.3, px: 0.5, py: 0.2, borderRadius: 0.5, fontSize: 10,
                                                                    bgcolor: event.isFuture ? 'warning.light' : 'action.hover',
                                                                    color: event.isFuture ? 'warning.contrastText' : 'text.primary',
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                }}>
                                                                    {event.country === 'KR' ? '🇰🇷' : '🇺🇸'} {event.name}{event.value ? ` ${event.value}` : ''}
                                                                </Box>
                                                            ))}
                                                            {indicatorEvents.length > 3 && (
                                                                <Chip label={`+${indicatorEvents.length - 3}`} size="small" variant="outlined"
                                                                    sx={{height: 16, fontSize: 10}}/>
                                                            )}
                                                        </Box>
                                                    </>);
                                                })()}
                                            </Box>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 날짜 이벤트 상세 팝오버 */}
            <Popover open={Boolean(popoverAnchor)} anchorEl={popoverAnchor}
                onClose={() => setPopoverAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}>
                <Box sx={{p: 1.5, minWidth: 200, maxWidth: 300}}>
                    <Typography variant="caption" sx={{fontWeight: 700, mb: 1, display: 'block'}}>
                        {popoverDate.replaceAll('-', '.')}
                    </Typography>
                    {popoverEvents.filter(e => e.type === 'HOLIDAY').map((e, i) => (
                        <Typography key={`ph-${i}`} sx={{fontSize: 11, color: 'error.main', fontWeight: 600, mb: 0.3}}>
                            {e.name}
                        </Typography>
                    ))}
                    {popoverEvents.filter(e => e.type !== 'HOLIDAY').map((e, i) => (
                        <Box key={`pe-${i}`} sx={{
                            mb: 0.5, px: 0.5, py: 0.3, borderRadius: 0.5, fontSize: 11,
                            bgcolor: e.isFuture ? 'warning.light' : 'action.hover',
                            color: e.isFuture ? 'warning.contrastText' : 'text.primary',
                        }}>
                            {e.country === 'KR' ? '🇰🇷' : '🇺🇸'} {e.name}{e.value ? ` ${e.value}` : ''}
                        </Box>
                    ))}
                </Box>
            </Popover>

            {/* 제공 지표 안내 */}
            <Box sx={{mt: 3}}>
                <Typography variant="caption" color="text.secondary" sx={{display: 'block', mb: 0.5, fontWeight: 600}}>
                    제공 경제 지표
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{lineHeight: 1.8}}>
                    🇰🇷 한국: 기준금리, 소비자물가지수, GDP 성장률, 원/달러 환율<br/>
                    🇺🇸 미국: 기준금리, CPI, GDP, 실업률, 비농업고용지수(NFP), 신규 실업수당 청구건수, PCE 물가지수, 장단기 금리차<br/>
                    <Box component="span" sx={{display: 'inline-block', width: 10, height: 10, borderRadius: 0.5, bgcolor: 'warning.light', mr: 0.5, verticalAlign: 'middle'}}/> 미래 발표 예정 일정
                </Typography>
            </Box>
        </Box>
    );
}
