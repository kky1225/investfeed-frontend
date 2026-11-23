import {FormEvent, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";

/** 창을 열 때 채워 둘 시각들 (epoch ms): 지금 화면의 왼쪽 끝·가운데·오른쪽 끝 캔들 */
export interface DateJumpInitial {
    first: number,
    center: number,
    last: number,
}

interface ChartDateJumpDialogProps {
    open: boolean,
    withTime: boolean,                  // 분봉이면 시각도 받는다
    initial: DateJumpInitial | null,    // 비우면 빈칸으로 연다
    onClose: () => void,
    // 날짜 탭: 고른 날짜(와 시각)의 끝 시각. 그 시각을 담은 캔들로 옮기면 된다
    onSubmitDate: (time: number) => void,
    // 기간 탭: 시작 날짜(와 시각)의 처음 시각과 끝 날짜(와 시각)의 끝 시각 (CandleChartEngine.fitTimeRange)
    onSubmitRange: (from: number, to: number) => void,
}

type JumpTab = 'date' | 'range';

const pad2 = (value: number) => String(value).padStart(2, '0');
// 입력 칸의 값 형식 (브라우저 시간대 기준. 차트의 시간축 글자와 같다)
const dateValue = (time: number) => {
    const date = new Date(time);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};
const timeValue = (time: number) => {
    const date = new Date(time);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

/**
 * 입력한 날짜(와 시각)의 시작(edge: 'start') 또는 끝('end') 시각. 날짜가 비었거나 잘못되었으면 null.
 * 시각 칸이 비었으면 그날의 처음·끝으로 본다.
 * 끝 시각은 그 날짜·분을 담은 캔들을 찾는 데 쓴다(일봉 캔들의 시각이 자정이 아닐 수 있고, 주·월봉은 기간의 첫날이다).
 */
const timeOf = (date: string, time: string, withTime: boolean, edge: 'start' | 'end'): number | null => {
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return null;
    const end = edge === 'end';
    const [hour, minute] = withTime && time ? time.split(':').map(Number) : end ? [23, 59] : [0, 0];
    const result = new Date(0);
    // new Date(연, …) 는 0~99년을 1900년대로 바꾸므로 setFullYear 로 그대로 넣는다
    result.setFullYear(year, month - 1, day);
    result.setHours(hour, minute, end ? 59 : 0, end ? 999 : 0);
    return result.getTime();
};

/** 날짜 칸과 (분봉이면) 시각 칸 한 줄 */
const DateTimeFields = ({label, withTime, date, time, error, autoFocus, onDateChange, onTimeChange}: {
    label: string, withTime: boolean, date: string, time: string, error: string, autoFocus?: boolean,
    onDateChange: (value: string) => void, onTimeChange: (value: string) => void,
}) => (
    <Stack direction="row" spacing={1}>
        <TextField
            label={label}
            type="date"
            size="small"
            fullWidth
            autoFocus={autoFocus}
            value={date}
            onChange={event => onDateChange(event.target.value)}
            error={error !== ""}
            helperText={error || undefined}
            slotProps={{inputLabel: {shrink: true}}}
        />
        {withTime && (
            <TextField
                label="시각"
                type="time"
                size="small"
                fullWidth
                value={time}
                onChange={event => onTimeChange(event.target.value)}
                slotProps={{inputLabel: {shrink: true}}}
            />
        )}
    </Stack>
);

/**
 * 차트의 "날짜로 이동" 창. 날짜 탭은 한 날짜로 옮기고, 기간 탭은 시작부터 끝까지를 화면에 맞춘다.
 * 고른 탭은 창을 닫았다 열어도 그대로 둔다.
 */
export default function ChartDateJumpDialog({
    open, withTime, initial, onClose, onSubmitDate, onSubmitRange,
}: ChartDateJumpDialogProps) {
    const [tab, setTab] = useState<JumpTab>('date');
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [fromTime, setFromTime] = useState("");
    const [toDate, setToDate] = useState("");
    const [toTime, setToTime] = useState("");
    const [error, setError] = useState<{ field: 'date' | 'from' | 'to', message: string } | null>(null);

    // 창이 열릴 때마다 지금 보고 있는 자리로 다시 채운다.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setDate(initial ? dateValue(initial.center) : "");
            setTime(initial ? timeValue(initial.center) : "");
            setFromDate(initial ? dateValue(initial.first) : "");
            setFromTime(initial ? timeValue(initial.first) : "");
            setToDate(initial ? dateValue(initial.last) : "");
            setToTime(initial ? timeValue(initial.last) : "");
            setError(null);
        }
    }

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (tab === 'date') {
            const target = timeOf(date, time, withTime, 'end');
            if (target === null) {
                setError({field: 'date', message: "날짜를 입력해 주세요."});
                return;
            }
            onSubmitDate(target);
            return;
        }
        const from = timeOf(fromDate, fromTime, withTime, 'start');
        const to = timeOf(toDate, toTime, withTime, 'end');
        if (from === null) {
            setError({field: 'from', message: "시작 날짜를 입력해 주세요."});
        } else if (to === null) {
            setError({field: 'to', message: "끝 날짜를 입력해 주세요."});
        } else if (from > to) {
            setError({field: 'to', message: "끝이 시작보다 앞섭니다."});
        } else {
            onSubmitRange(from, to);
        }
    };

    const errorOf = (field: 'date' | 'from' | 'to') => error?.field === field ? error.message : "";
    const edit = (setter: (value: string) => void) => (value: string) => {
        setter(value);
        setError(null);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <form onSubmit={handleSubmit} noValidate>
                <DialogTitle>날짜로 이동</DialogTitle>
                <Tabs
                    value={tab}
                    onChange={(_, next: JumpTab) => {
                        setTab(next);
                        setError(null);
                    }}
                    variant="fullWidth"
                    sx={{px: 3}}
                >
                    <Tab value="date" label="날짜"/>
                    <Tab value="range" label="기간"/>
                </Tabs>
                <DialogContent>
                    {tab === 'date' ? (
                        <Stack sx={{pt: 1}}>
                            <DateTimeFields
                                label="날짜" withTime={withTime} date={date} time={time} error={errorOf('date')} autoFocus
                                onDateChange={edit(setDate)} onTimeChange={edit(setTime)}
                            />
                        </Stack>
                    ) : (
                        <Stack spacing={2} sx={{pt: 1}}>
                            <DateTimeFields
                                label="시작" withTime={withTime} date={fromDate} time={fromTime} error={errorOf('from')} autoFocus
                                onDateChange={edit(setFromDate)} onTimeChange={edit(setFromTime)}
                            />
                            <DateTimeFields
                                label="끝" withTime={withTime} date={toDate} time={toTime} error={errorOf('to')}
                                onDateChange={edit(setToDate)} onTimeChange={edit(setToTime)}
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>닫기</Button>
                    <Button type="submit">이동</Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
