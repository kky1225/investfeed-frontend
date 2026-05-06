import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {requireOk} from '../../lib/apiResponse';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
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
import {fetchAdminBrokerList, createBroker, updateBroker, deleteBroker} from '../../api/broker/BrokerApi';
import type {Broker, BrokerType, BrokerMarket, CreateBrokerReq, UpdateBrokerMutationVars} from '../../type/BrokerType';
import {useAlert} from '../../context/AlertContext';

export default function BrokerManagement() {
    const showAlert = useAlert();
    const queryClient = useQueryClient();

    const {data: brokersData, isLoading: loading, isError: brokersError} = useQuery<Broker[]>({
        queryKey: ['admin', 'brokers'],
        queryFn: async ({signal}) => {
            const data = requireOk<{brokers?: Broker[]} | null>(await fetchAdminBrokerList({signal, skipGlobalError: true}), null);
            return data?.brokers ?? [];
        },
    });
    const brokers = brokersData ?? [];

    const [prevError, setPrevError] = useState(false);
    if (brokersError !== prevError) {
        setPrevError(brokersError);
        if (brokersError) showAlert('증권사 목록을 불러오는데 실패했습니다.', 'error');
    }

    const loadBrokers = async () => {
        await queryClient.invalidateQueries({queryKey: ['admin', 'brokers']});
    };

    // 등록/수정 공통 state
    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formTargetId, setFormTargetId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [type, setType] = useState<BrokerType>('MANUAL');
    const [market, setMarket] = useState<BrokerMarket>('STOCK');
    const [formErrors, setFormErrors] = useState<{name?: string}>({});

    const [deleteTarget, setDeleteTarget] = useState<Broker | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTarget, setMenuTarget] = useState<Broker | null>(null);

    const resetForm = () => {
        setFormOpen(false);
        setFormMode('create');
        setFormTargetId(null);
        setName('');
        setType('MANUAL');
        setMarket('STOCK');
        setFormErrors({});
    };

    const openCreateForm = () => {
        resetForm();
        setFormOpen(true);
    };

    const openEditForm = (broker: Broker) => {
        setFormMode('edit');
        setFormTargetId(broker.id);
        setName(broker.name);
        setType(broker.type);
        setMarket(broker.market);
        setFormOpen(true);
    };

    const onSubmitError = (err: unknown) => {
        console.error(err);
        const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
        if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
            setFormErrors(axiosErr.response.data.result ?? {});
            return;
        }
        showAlert(formMode === 'create' ? '증권사 등록에 실패했습니다.' : '증권사 수정에 실패했습니다.', 'error');
    };

    const createMutation = useMutation({
        mutationFn: async (req: CreateBrokerReq) =>
            requireOk(await createBroker(req), '증권사 등록'),
        onSuccess: (_data, req) => {
            showAlert(`${req.name} 증권사가 등록되었습니다.`, 'success');
            resetForm();
            loadBrokers();
        },
        onError: onSubmitError,
    });

    const updateMutation = useMutation({
        mutationFn: async (vars: UpdateBrokerMutationVars) =>
            requireOk(await updateBroker(vars.id, vars.req), '증권사 수정'),
        onSuccess: (_data, vars) => {
            showAlert(`${vars.req.name} 증권사가 수정되었습니다.`, 'success');
            resetForm();
            loadBrokers();
        },
        onError: onSubmitError,
    });

    const deleteMutation = useMutation({
        mutationFn: async (broker: Broker) => {
            requireOk(await deleteBroker(broker.id), '증권사 삭제');
            return broker;
        },
        onSuccess: (broker) => {
            showAlert(`${broker.name} 증권사가 삭제되었습니다.`, 'success');
            loadBrokers();
            setDeleteTarget(null);
        },
        onError: (err) => {
            console.error(err);
            showAlert('증권사 삭제에 실패했습니다.', 'error');
            setDeleteTarget(null);
        },
    });

    const handleSubmit = () => {
        const errors: {name?: string} = {};
        if (!name.trim()) errors.name = '증권사명을 입력해주세요.';
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        if (formMode === 'create') {
            const req: CreateBrokerReq = {name: name.trim(), type, market};
            createMutation.mutate(req);
        } else if (formTargetId !== null) {
            const vars: UpdateBrokerMutationVars = {id: formTargetId, req: {name: name.trim(), type, market}};
            updateMutation.mutate(vars);
        }
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget);
    };

    const columns: GridColDef[] = [
        {
            field: 'no', headerName: 'No', width: 80,
            renderCell: (params) => {
                const index = brokers.findIndex(b => b.id === params.row.id);
                return index + 1;
            }
        },
        {field: 'name', headerName: '증권사명', flex: 1, minWidth: 200},
        {
            field: 'market', headerName: '시장', width: 100,
            renderCell: (params) => (
                <Chip
                    label={params.value === 'STOCK' ? '주식' : '암호화폐'}
                    size="small"
                    color={params.value === 'STOCK' ? 'default' : 'warning'}
                />
            )
        },
        {
            field: 'type', headerName: '타입', width: 120,
            renderCell: (params) => (
                <Chip
                    label={params.value === 'API' ? 'API 연동' : '수동 입력'}
                    size="small"
                    color={params.value === 'API' ? 'primary' : 'default'}
                />
            )
        },
        {
            field: 'actions', headerName: '관리', width: 70, sortable: false, align: 'center', headerAlign: 'center',
            renderCell: (params) => (
                <IconButton
                    size="small"
                    onClick={(e) => {
                        setAnchorEl(e.currentTarget);
                        setMenuTarget(params.row as Broker);
                    }}
                >
                    <MoreVertIcon/>
                </IconButton>
            )
        },
    ];

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography component="h2" variant="h6">
                    증권사 관리
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon/>}
                    onClick={openCreateForm}
                >
                    증권사 추가
                </Button>
            </Box>

            <DataGrid
                rows={brokers}
                columns={columns}
                loading={loading}
                autoHeight
                pageSizeOptions={[10, 20, 50, 100]}
                initialState={{
                    pagination: {paginationModel: {pageSize: 10}},
                }}
                disableRowSelectionOnClick
                slotProps={{
                    loadingOverlay: {
                        variant: 'skeleton',
                        noRowsVariant: 'skeleton',
                    },
                }}
                sx={{
                    '& .MuiDataGrid-cell': {
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
            />

            {/* 더보기 메뉴 */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={() => {
                    if (menuTarget) openEditForm(menuTarget);
                    setAnchorEl(null);
                }}>
                    <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>수정</ListItemText>
                </MenuItem>
                <MenuItem sx={{color: 'error.main'}} onClick={() => {
                    setDeleteTarget(menuTarget);
                    setAnchorEl(null);
                }}>
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error"/></ListItemIcon>
                    <ListItemText>삭제</ListItemText>
                </MenuItem>
            </Menu>

            {/* 등록/수정 다이얼로그 */}
            <Dialog open={formOpen} onClose={resetForm} maxWidth="xs" fullWidth>
                <DialogTitle>{formMode === 'create' ? '증권사 추가' : '증권사 수정'}</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField
                            autoFocus fullWidth required size="small" label="증권사명"
                            value={name}
                            onChange={e => { setName(e.target.value); if (formErrors.name) setFormErrors(prev => ({...prev, name: undefined})); }}
                            onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleSubmit()}
                            error={!!formErrors.name} helperText={formErrors.name}
                            slotProps={{htmlInput: {maxLength: 20}}}
                        />
                        <Box>
                            <Typography variant="body2" sx={{mb: 1, color: 'text.secondary'}}>시장</Typography>
                            <ToggleButtonGroup
                                value={market}
                                exclusive
                                onChange={(_, v) => v && setMarket(v)}
                                size="small"
                                fullWidth
                            >
                                <ToggleButton value="STOCK">주식</ToggleButton>
                                <ToggleButton value="CRYPTO">암호화폐</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{mb: 1, color: 'text.secondary'}}>타입</Typography>
                            <ToggleButtonGroup
                                value={type}
                                exclusive
                                onChange={(_, v) => v && setType(v)}
                                size="small"
                                fullWidth
                            >
                                <ToggleButton value="MANUAL">수동 입력</ToggleButton>
                                <ToggleButton value="API">API 연동</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={resetForm}>취소</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) ? '처리 중...' : formMode === 'create' ? '등록' : '수정'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 삭제 확인 다이얼로그 */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>증권사 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        <b>{deleteTarget?.name}</b>을(를) 삭제하시겠습니까?
                        <br/>
                        해당 증권사를 사용 중인 회원의 보유주식도 함께 삭제됩니다.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button color="error" onClick={handleDelete} variant="contained" disabled={deleteMutation.isPending}>삭제</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
