import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
    fetchMarketSessions, createMarketSession, updateMarketSession, deleteMarketSession,
} from '../../api/calendar/EconomicCalendarApi';
import type {MarketSession, MarketSessionReq, UpdateMarketSessionMutationVars} from '../../type/EconomicCalendarType';
import {requireOk} from '../../lib/apiResponse';
import {useAlert} from '../../context/AlertContext';

type FormErrors = {date?: string; name?: string; openTime?: string; closeTime?: string};

// 지금까지 확인한 장 시각 변경일(수능일·새해 첫 거래일)은 모두 10시 개장·NXT 프리마켓 휴장이라 그 값을 기본으로 둔다
const DEFAULT_FORM = {date: '', name: '', openTime: '10:00', closeTime: '16:30', preMarket: false};

/** 캘린더 관리 > 장 시각 변경 탭. 국내 장 시각이 평소(09:00~15:30)와 다른 날 (수능일 등) */
export default function MarketSessionTab({year, onYearChange}: {year: number; onYearChange: (year: number) => void}) {
    const queryClient = useQueryClient();
    const showAlert = useAlert();

    const [formOpen, setFormOpen] = useState(false);
    const [formTargetId, setFormTargetId] = useState<number | null>(null);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [deleteTarget, setDeleteTarget] = useState<MarketSession | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTarget, setMenuTarget] = useState<MarketSession | null>(null);

    const queryKey = ['admin', 'marketSessions', year];
    const {data: sessions = [], isLoading: loading} = useQuery<MarketSession[]>({
        queryKey,
        queryFn: async ({signal}) => requireOk(await fetchMarketSessions(year, {signal, skipGlobalError: true}), [] as MarketSession[]),
    });

    const reload = () => queryClient.invalidateQueries({queryKey});

    const resetForm = () => {
        setFormOpen(false);
        setFormTargetId(null);
        setForm(DEFAULT_FORM);
        setFormErrors({});
    };

    const openCreateForm = () => {
        resetForm();
        setFormOpen(true);
    };

    const openEditForm = (s: MarketSession) => {
        setFormTargetId(s.id);
        setForm({date: s.date, name: s.name, openTime: s.openTime, closeTime: s.closeTime, preMarket: s.preMarket});
        setFormErrors({});
        setFormOpen(true);
        setAnchorEl(null);
    };

    // 서버 안내(이미 등록된 날짜 등)가 있으면 그 문구를 보여 준다
    const onError = (fallback: string) => (err: unknown) => {
        console.error(err);
        const msg = (err as {response?: {data?: {message?: string}}})?.response?.data?.message
            ?? (err instanceof Error ? err.message : null) ?? fallback;
        showAlert(msg, 'error');
    };

    const createMutation = useMutation({
        mutationFn: async (req: MarketSessionReq) => requireOk(await createMarketSession(req), '장 시각 변경일 등록'),
        onSuccess: () => {
            showAlert('장 시각 변경일이 등록되었습니다.', 'success');
            resetForm();
            reload();
        },
        onError: onError('장 시각 변경일 등록에 실패했습니다.'),
    });

    const updateMutation = useMutation({
        mutationFn: async (vars: UpdateMarketSessionMutationVars) =>
            requireOk(await updateMarketSession(vars.id, vars.req), '장 시각 변경일 수정'),
        onSuccess: () => {
            showAlert('장 시각 변경일이 수정되었습니다.', 'success');
            resetForm();
            reload();
        },
        onError: onError('장 시각 변경일 수정에 실패했습니다.'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            requireOk(await deleteMarketSession(id), '장 시각 변경일 삭제');
        },
        onSuccess: () => {
            showAlert('장 시각 변경일이 삭제되었습니다.', 'success');
            setDeleteTarget(null);
            reload();
        },
        onError: onError('장 시각 변경일 삭제에 실패했습니다.'),
    });

    const handleSubmit = () => {
        const errors: FormErrors = {};
        if (!form.date) errors.date = '날짜를 입력해주세요.';
        if (!form.name.trim()) errors.name = '이름을 입력해주세요.';
        if (!form.openTime) errors.openTime = '개장 시각을 입력해주세요.';
        if (!form.closeTime) errors.closeTime = '마감 시각을 입력해주세요.';
        else if (form.openTime && form.closeTime <= form.openTime) errors.closeTime = '마감 시각은 개장 시각보다 늦어야 합니다.';
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        const req: MarketSessionReq = {...form, name: form.name.trim()};
        if (formTargetId == null) {
            createMutation.mutate(req);
        } else {
            const vars: UpdateMarketSessionMutationVars = {id: formTargetId, req};
            updateMutation.mutate(vars);
        }
    };

    const setField = <K extends keyof typeof DEFAULT_FORM>(key: K, value: (typeof DEFAULT_FORM)[K]) => {
        setForm(prev => ({...prev, [key]: value}));
        if (key in formErrors) setFormErrors(prev => ({...prev, [key]: undefined}));
    };

    const columns: GridColDef<MarketSession>[] = [
        {field: 'date', headerName: '날짜', width: 130},
        {field: 'name', headerName: '이름', flex: 1, minWidth: 160},
        {field: 'openTime', headerName: '개장', width: 90},
        {field: 'closeTime', headerName: '마감', width: 90},
        {field: 'preMarket', headerName: 'NXT 프리마켓', width: 120, renderCell: (params) => (
            <Chip label={params.value ? '운영' : '휴장'} size="small" variant="outlined" sx={{height: 22, fontSize: 11}}/>
        )},
        {field: 'actions', headerName: '관리', width: 60, sortable: false, renderCell: (params) => (
            <IconButton size="small" onClick={(e) => { setAnchorEl(e.currentTarget); setMenuTarget(params.row); }}>
                <MoreVertIcon fontSize="small"/>
            </IconButton>
        )},
    ];

    return (
        <Box>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <TextField size="small" type="number" value={year} onChange={e => onYearChange(Number(e.target.value))}
                        sx={{width: 100}} slotProps={{htmlInput: {min: 2021, max: 2030}}}/>
                    <Typography variant="body2">년</Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon/>} onClick={openCreateForm} size="small">
                    변경일 추가
                </Button>
            </Box>

            <DataGrid
                rows={sessions}
                columns={columns}
                loading={loading}
                autoHeight
                hideFooter
                localeText={{noRowsLabel: '데이터가 없습니다'}}
                disableRowSelectionOnClick
                slotProps={{loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'}}}
                sx={{'& .MuiDataGrid-cell': {display: 'flex', alignItems: 'center'}}}
            />

            <Typography variant="caption" color="text.secondary" component="div" sx={{mt: 3, lineHeight: 1.8}}>
                국내 장 시각이 평소(09:00~15:30)와 다른 날을 등록합니다. 수능일은 해마다 날짜가 달라 직접 등록해야 합니다.<br/>
                새해 첫 거래일(10:00 개장·15:30 마감·프리마켓 휴장)은 자동으로 적용되며, 시각이 다르게 공지된 해에만 등록하면 등록한 값이 우선합니다.<br/>
                등록하면 모의투자 주문·마감 브리핑·알림·실시간 시세가 그날 장 시각에 맞춰 움직이고, 경제 캘린더에도 표시됩니다.
            </Typography>

            {/* 등록/수정 다이얼로그 */}
            <Dialog open={formOpen} onClose={resetForm} maxWidth="xs" fullWidth>
                <DialogTitle>{formTargetId == null ? '장 시각 변경일 추가' : '장 시각 변경일 수정'}</DialogTitle>
                <DialogContent sx={{display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important'}}>
                    <TextField label="날짜" type="date" size="small" fullWidth required
                        slotProps={{inputLabel: {shrink: true}}}
                        value={form.date} onChange={e => setField('date', e.target.value)}
                        error={!!formErrors.date} helperText={formErrors.date}/>
                    <TextField label="이름" size="small" fullWidth required placeholder="수능일"
                        value={form.name} onChange={e => setField('name', e.target.value)}
                        error={!!formErrors.name} helperText={formErrors.name}/>
                    <Box sx={{display: 'flex', gap: 2}}>
                        <TextField label="개장" type="time" size="small" fullWidth required
                            slotProps={{inputLabel: {shrink: true}}}
                            value={form.openTime} onChange={e => setField('openTime', e.target.value)}
                            error={!!formErrors.openTime} helperText={formErrors.openTime}/>
                        <TextField label="마감" type="time" size="small" fullWidth required
                            slotProps={{inputLabel: {shrink: true}}}
                            value={form.closeTime} onChange={e => setField('closeTime', e.target.value)}
                            error={!!formErrors.closeTime} helperText={formErrors.closeTime}/>
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={form.preMarket} onChange={e => setField('preMarket', e.target.checked)}/>}
                        label="NXT 프리마켓 운영"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={resetForm}>취소</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                        {formTargetId == null ? '등록' : '수정'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 삭제 확인 다이얼로그 */}
            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
                <DialogTitle>장 시각 변경일 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        '{deleteTarget?.name}' ({deleteTarget?.date})을 삭제하시겠습니까? 삭제하면 그날은 평소 장 시각으로 동작합니다.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button variant="contained" color="error" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        disabled={deleteMutation.isPending}>삭제</Button>
                </DialogActions>
            </Dialog>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => { setAnchorEl(null); setMenuTarget(null); }}>
                <MenuItem onClick={() => { if (menuTarget) openEditForm(menuTarget); }}>
                    <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>수정</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { setDeleteTarget(menuTarget); setAnchorEl(null); }}>
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error"/></ListItemIcon>
                    <ListItemText sx={{color: 'error.main'}}>삭제</ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
}
