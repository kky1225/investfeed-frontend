import {useMemo, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import {DataGrid, type GridColDef, type GridRenderCellParams} from "@mui/x-data-grid";
import Skeleton from "@mui/material/Skeleton";
import BlindText from "../../components/BlindText.tsx";
import {useBlindMode} from "../../context/BlindModeContext.tsx";
import type {RealizedPnlItem} from "../../type/RealizedPnlType.ts";
import type {MemberBroker} from "../../type/BrokerType.ts";
import {
    fetchCryptoRealizedPnlList,
    createCryptoManualPnl,
    updateCryptoManualPnl,
    deleteCryptoManualPnl,
} from "../../api/realizedPnl/RealizedPnlApi.ts";
import AddManualPnlDialog from "../holding/AddManualPnlDialog.tsx";
import EditManualPnlDialog from "../holding/EditManualPnlDialog.tsx";
import {requireOk} from "../../lib/apiResponse.ts";

type ViewMode = 'monthly' | 'yearly' | 'all';

interface CryptoRealizedPnlTabProps {
    myBrokers: MemberBroker[];
}

export default function CryptoRealizedPnlTab({myBrokers}: CryptoRealizedPnlTabProps) {
    const currentDate = new Date();
    const queryClient = useQueryClient();
    const [selectedBrokerTab, setSelectedBrokerTab] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [addOpen, setAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<RealizedPnlItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<RealizedPnlItem | null>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [menuTarget, setMenuTarget] = useState<RealizedPnlItem | null>(null);
    const {isBlind} = useBlindMode();

    const [showList, setShowList] = useState(!isBlind);
    const [prevIsBlind, setPrevIsBlind] = useState(isBlind);
    if (isBlind !== prevIsBlind) {
        setPrevIsBlind(isBlind);
        setShowList(!isBlind);
    }

    const selectedBroker = myBrokers[selectedBrokerTab];

    const {data: allItems, isLoading: loading} = useQuery<RealizedPnlItem[]>({
        queryKey: ['cryptoRealizedPnl', selectedBroker?.brokerId, viewMode, year, month],
        queryFn: async ({signal}) => {
            const yearParam = viewMode !== 'all' ? year : undefined;
            const monthParam = viewMode === 'monthly' ? month : undefined;
            return requireOk(await fetchCryptoRealizedPnlList(yearParam, monthParam, {signal, skipGlobalError: true}), {items: [] as RealizedPnlItem[]}).items ?? [];
        },
        enabled: myBrokers.length > 0 && !!selectedBroker,
        refetchOnWindowFocus: false,
    });

    const items = useMemo<RealizedPnlItem[]>(() => {
        if (!allItems || !selectedBroker) return [];
        return allItems.filter(item => item.brokerId === selectedBroker.brokerId);
    }, [allItems, selectedBroker]);

    const totalPnl = useMemo<number>(() => {
        return items.reduce((sum, item) => sum + item.realizedPnl, 0);
    }, [items]);

    const reload = () => {
        queryClient.invalidateQueries({queryKey: ['cryptoRealizedPnl']});
    };

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            requireOk(await deleteCryptoManualPnl(id), '실현손익 삭제');
        },
        onSuccess: () => {
            reload();
            setDeleteTarget(null);
        },
        onError: (err) => {
            console.error(err);
            setDeleteTarget(null);
        },
    });

    const handleDelete = () => {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget.id);
    };

    const pnlColor = totalPnl > 0 ? 'error.main' : totalPnl < 0 ? 'info.main' : 'text.primary';
    const years = Array.from({length: 10}, (_, i) => currentDate.getFullYear() - i);
    const months = Array.from({length: 12}, (_, i) => i + 1);

    const columns: GridColDef[] = [
        {field: 'period', headerName: '기간', flex: 1, minWidth: 120, valueGetter: (_value, row) => `${row.year}년 ${row.month}월`},
        {
            field: 'realizedPnl', headerName: '실현손익', flex: 1, minWidth: 150, align: 'right', headerAlign: 'right',
            renderCell: (params) => {
                const val = params.value as number;
                const color = val > 0 ? 'error.main' : val < 0 ? 'info.main' : 'text.primary';
                return <BlindText><Typography variant="body2" sx={{color, fontWeight: 600}}>{val > 0 ? '+' : ''}{val.toLocaleString()}원</Typography></BlindText>;
            }
        },
        {
            field: 'actions', headerName: '관리', width: 70, sortable: false, align: 'center', headerAlign: 'center',
            renderCell: (params: GridRenderCellParams) => (
                <IconButton size="small" onClick={(e) => { setAnchorEl(e.currentTarget); setMenuTarget(params.row as RealizedPnlItem); }}>
                    <MoreVertIcon/>
                </IconButton>
            )
        },
    ];

    if (myBrokers.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
                등록된 거래소가 없습니다.
            </Typography>
        );
    }

    return (
        <Box>
            {/* 거래소 탭 */}
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, borderBottom: 1, borderColor: 'divider'}}>
                <Tabs
                    value={selectedBrokerTab}
                    onChange={(_, v) => setSelectedBrokerTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{flexGrow: 1}}
                >
                    {myBrokers.map((broker) => (
                        <Tab
                            key={broker.id}
                            label={
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                    <span>{broker.name}</span>
                                    {broker.type === "API" && <LinkIcon fontSize="small" sx={{fontSize: 16}}/>}
                                </Stack>
                            }
                        />
                    ))}
                </Tabs>
            </Box>

            {/* 조회 조건 */}
            <Stack direction="row" spacing={1} sx={{mb: 2}} alignItems="center">
                <TextField
                    select size="small" value={viewMode}
                    onChange={(e) => setViewMode(e.target.value as ViewMode)}
                    sx={{minWidth: 100}}
                >
                    <MenuItem value="monthly">월별</MenuItem>
                    <MenuItem value="yearly">연별</MenuItem>
                    <MenuItem value="all">전체</MenuItem>
                </TextField>
                {viewMode !== 'all' && (
                    <TextField
                        select size="small" value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        sx={{minWidth: 100}}
                    >
                        {years.map(y => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
                    </TextField>
                )}
                {viewMode === 'monthly' && (
                    <TextField
                        select size="small" value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        sx={{minWidth: 80}}
                    >
                        {months.map(m => <MenuItem key={m} value={m}>{m}월</MenuItem>)}
                    </TextField>
                )}
                <Box sx={{flex: 1}}/>
                <Button size="small" variant="contained" startIcon={<AddIcon/>} onClick={() => setAddOpen(true)}>
                    등록
                </Button>
            </Stack>

            {/* 요약 카드 */}
            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent>
                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                        {viewMode === 'monthly' ? `${year}년 ${month}월` : viewMode === 'yearly' ? `${year}년` : '전체'} 실현손익
                    </Typography>
                    <Typography variant="h4" sx={{fontWeight: 700, color: loading ? undefined : pnlColor}}>
                        {loading ? <Skeleton width="40%"/> : <BlindText>{totalPnl > 0 ? '+' : ''}{totalPnl.toLocaleString()}원</BlindText>}
                    </Typography>
                </CardContent>
            </Card>

            <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 1}}>
                <Button
                    size="small"
                    endIcon={showList ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                    onClick={() => setShowList(!showList)}
                >
                    {showList ? '내역 접기' : '내역 펼치기'}
                </Button>
            </Box>

            <Collapse in={showList}>
                <DataGrid
                    rows={items}
                    columns={columns}
                    disableRowSelectionOnClick
                    pageSizeOptions={[10, 20, 50, 100]}
                    initialState={{pagination: {paginationModel: {pageSize: 10}}}}
                    loading={loading}
                    slotProps={{
                        loadingOverlay: {
                            variant: 'skeleton',
                            noRowsVariant: 'skeleton',
                        },
                    }}
                    localeText={{noRowsLabel: '데이터가 없습니다.'}}
                    sx={{
                        '& .MuiDataGrid-cell': {cursor: 'default', display: 'flex', alignItems: 'center'},
                        border: 'none',
                    }}
                />
            </Collapse>

            {/* 다이얼로그 */}
            {selectedBroker && (
                <AddManualPnlDialog
                    open={addOpen}
                    onClose={() => setAddOpen(false)}
                    brokers={[selectedBroker]}
                    onCreated={reload}
                    createFn={createCryptoManualPnl}
                />
            )}

            <EditManualPnlDialog
                open={Boolean(editItem)}
                onClose={() => setEditItem(null)}
                item={editItem}
                onUpdated={reload}
                updateFn={updateCryptoManualPnl}
            />

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => { setEditItem(menuTarget); setAnchorEl(null); }}>
                    <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>수정</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { setDeleteTarget(menuTarget); setAnchorEl(null); }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error"/></ListItemIcon>
                    <ListItemText>삭제</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>실현손익 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {deleteTarget?.year}년 {deleteTarget?.month}월 실현손익을 삭제하시겠습니까?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button color="error" onClick={handleDelete} disabled={deleteMutation.isPending}>삭제</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
