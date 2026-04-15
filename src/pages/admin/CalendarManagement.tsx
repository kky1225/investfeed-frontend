import {useEffect, useState} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
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
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {fetchManualCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent} from '../../api/calendar/EconomicCalendarApi';
import type {CalendarEvent} from '../../type/EconomicCalendarType';

export default function CalendarManagement() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error'}>({
        open: false, message: '', severity: 'success'
    });

    // 등록/수정 공통 state
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formTargetId, setFormTargetId] = useState<number | null>(null);
    const [formDate, setFormDate] = useState('');
    const [formName, setFormName] = useState('');
    const [formCountry, setFormCountry] = useState('KR');
    const [formType, setFormType] = useState('RATE_DECISION');
    const [formValue, setFormValue] = useState('');
    const [formLoading, setFormLoading] = useState(false);
    const [formErrors, setFormErrors] = useState<{date?: string; name?: string; country?: string; type?: string}>({});

    const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTarget, setMenuTarget] = useState<CalendarEvent | null>(null);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const res = await fetchManualCalendarEvents({year, month: 0});
            setEvents(res.result ?? []);
        } catch {
            setSnackbar({open: true, message: '일정 목록을 불러오는데 실패했습니다.', severity: 'error'});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, [year]);

    const resetForm = () => {
        setFormOpen(false);
        setFormMode('create');
        setFormTargetId(null);
        setFormDate('');
        setFormName('');
        setFormCountry('KR');
        setFormType('MEETING');
        setFormValue('');
        setFormErrors({});
    };

    const openCreateForm = () => {
        resetForm();
        setFormOpen(true);
    };

    const openEditForm = (event: CalendarEvent) => {
        setFormMode('edit');
        setFormTargetId(event.id);
        setFormDate(event.date);
        setFormName(event.name);
        setFormCountry(event.country);
        setFormType(event.type);
        setFormValue(event.value ?? '');
        setFormOpen(true);
        setAnchorEl(null);
    };

    const handleSubmit = async () => {
        const errors: {date?: string; name?: string; country?: string; type?: string} = {};
        if (!formDate) errors.date = '날짜를 입력해주세요.';
        if (!formName.trim()) errors.name = '일정명을 입력해주세요.';
        if (!formCountry) errors.country = '국가를 선택해주세요.';
        if (!formType) errors.type = '유형을 선택해주세요.';
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        setFormLoading(true);
        try {
            const req = {date: formDate, name: formName, country: formCountry, type: formType, value: formValue || null};
            if (formMode === 'create') {
                await createCalendarEvent(req);
                setSnackbar({open: true, message: '일정이 등록되었습니다.', severity: 'success'});
            } else if (formTargetId) {
                await updateCalendarEvent(formTargetId, req);
                setSnackbar({open: true, message: '일정이 수정되었습니다.', severity: 'success'});
            }
            resetForm();
            loadEvents();
        } catch {
            setSnackbar({open: true, message: '일정 처리에 실패했습니다.', severity: 'error'});
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;
        try {
            await deleteCalendarEvent(deleteTarget.id);
            setSnackbar({open: true, message: '일정이 삭제되었습니다.', severity: 'success'});
            setDeleteTarget(null);
            loadEvents();
        } catch {
            setSnackbar({open: true, message: '일정 삭제에 실패했습니다.', severity: 'error'});
        }
    };

    const typeLabel = (type: string) => {
        switch (type) {
            case 'RATE_DECISION': return '한국 기준금리 결정';
            case 'US_RATE_DECISION': return '미국 기준금리 결정';
            case 'GDP_RELEASE': return 'GDP 발표';
            case 'CUSTOM': return '수동 입력';
            case 'HOLIDAY': return '공휴일';
            default: return type;
        }
    };

    const columns: GridColDef[] = [
        {
            field: 'no', headerName: 'No', width: 80,
            renderCell: (params) => {
                const index = events.findIndex(e => e.id === params.row.id);
                return index + 1;
            }
        },
        {field: 'date', headerName: '날짜', width: 130},
        {field: 'name', headerName: '일정명', flex: 1, minWidth: 180},
        {field: 'country', headerName: '국가', width: 80, renderCell: (params) => (
            <Chip label={params.value === 'KR' ? '한국' : '미국'} size="small" variant="outlined" sx={{height: 22, fontSize: 11}}/>
        )},
        {field: 'type', headerName: '유형', width: 170, renderCell: (params) => typeLabel(params.value)},
        {field: 'value', headerName: '값', width: 120, renderCell: (params) => params.value || '-'},
        {field: 'actions', headerName: '관리', width: 60, sortable: false, renderCell: (params) => (
            <IconButton size="small" onClick={(e) => { setAnchorEl(e.currentTarget); setMenuTarget(params.row); }}>
                <MoreVertIcon fontSize="small"/>
            </IconButton>
        )},
    ];

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>일정 관리</Typography>

            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <TextField size="small" type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                        sx={{width: 100}} slotProps={{htmlInput: {min: 2021, max: 2030}}}/>
                    <Typography variant="body2">년</Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon/>} onClick={openCreateForm} size="small">
                    일정 추가
                </Button>
            </Box>

            <DataGrid
                rows={events}
                columns={columns}
                loading={loading}
                autoHeight
                pageSizeOptions={[10, 20, 50, 100]}
                initialState={{pagination: {paginationModel: {pageSize: 20}}}}
                localeText={{noRowsLabel: '데이터가 없습니다'}}
                disableRowSelectionOnClick
                sx={{
                    '& .MuiDataGrid-cell': {
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
            />

            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 3}}>
                한국 기준금리 발표 일정, 한국 GDP 발표 일정, 미국 기준금리(FOMC) 발표 일정은 직접 일정을 등록해야 합니다.
            </Typography>

            {/* 등록/수정 다이얼로그 */}
            <Dialog open={formOpen} onClose={resetForm} maxWidth="xs" fullWidth>
                <DialogTitle>{formMode === 'create' ? '일정 추가' : '일정 수정'}</DialogTitle>
                <DialogContent sx={{display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important'}}>
                    <TextField label="날짜" type="date" size="small" fullWidth required
                        slotProps={{inputLabel: {shrink: true}}}
                        value={formDate}
                        onChange={e => { setFormDate(e.target.value); if (formErrors.date) setFormErrors(prev => ({...prev, date: undefined})); }}
                        error={!!formErrors.date} helperText={formErrors.date}/>
                    <TextField label="일정명" size="small" fullWidth required
                        value={formName}
                        onChange={e => { setFormName(e.target.value); if (formErrors.name) setFormErrors(prev => ({...prev, name: undefined})); }}
                        error={!!formErrors.name} helperText={formErrors.name}/>
                    <TextField label="국가" size="small" fullWidth required select
                        value={formCountry}
                        onChange={e => { setFormCountry(e.target.value); if (formErrors.country) setFormErrors(prev => ({...prev, country: undefined})); }}
                        error={!!formErrors.country} helperText={formErrors.country}>
                        <MenuItem value="KR">한국</MenuItem>
                        <MenuItem value="US">미국</MenuItem>
                    </TextField>
                    <TextField label="유형" size="small" fullWidth required select
                        value={formType}
                        onChange={e => { setFormType(e.target.value); if (formErrors.type) setFormErrors(prev => ({...prev, type: undefined})); }}
                        error={!!formErrors.type} helperText={formErrors.type}>
                        <MenuItem value="RATE_DECISION">한국 기준금리 결정</MenuItem>
                        <MenuItem value="US_RATE_DECISION">미국 기준금리 결정</MenuItem>
                        <MenuItem value="GDP_RELEASE">GDP 발표</MenuItem>
                        <MenuItem value="CUSTOM">수동 입력</MenuItem>
                    </TextField>
                    <TextField label="값 (선택)" size="small" fullWidth value={formValue} onChange={e => setFormValue(e.target.value)}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={resetForm}>취소</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={formLoading}>
                        {formMode === 'create' ? '등록' : '수정'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 삭제 확인 다이얼로그 */}
            <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
                <DialogTitle>일정 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        '{deleteTarget?.name}' ({deleteTarget?.date}) 일정을 삭제하시겠습니까?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
                </DialogActions>
            </Dialog>

            {/* MoreVert 메뉴 */}
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

            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({...snackbar, open: false})}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({...snackbar, open: false})}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
