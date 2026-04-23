import {useEffect, useState} from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Tooltip from "@mui/material/Tooltip";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import BlindText from "../../components/BlindText.tsx";
import BlindToggle from "../../components/BlindToggle.tsx";
import {fetchGoalDashboard, deleteGoal} from "../../api/goal/GoalApi.ts";
import type {InvestmentGoalRes} from "../../type/GoalType.ts";
import {goalTypeLabel} from "../../type/GoalType.ts";
import GoalSettingDialog from "../assetDashboard/GoalSettingDialog.tsx";

export default function GoalPage() {
    const [goals, setGoals] = useState<InvestmentGoalRes[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [goalDialogOpen, setGoalDialogOpen] = useState(false);
    const [editGoal, setEditGoal] = useState<InvestmentGoalRes | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<InvestmentGoalRes | null>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [menuTarget, setMenuTarget] = useState<InvestmentGoalRes | null>(null);

    const loadGoals = async () => {
        try {
            const res = await fetchGoalDashboard();
            if (res.code === "0000") {
                setGoals(res.result?.goals ?? []);
                setLastUpdated(new Date());
            }
        } catch {
            // 무시
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;

        (async () => {
            await loadGoals();

            const now = Date.now();
            const waitTime = 60_000 - (now % 60_000);

            timeout = setTimeout(() => {
                loadGoals();
                interval = setInterval(() => {
                    loadGoals();
                }, 60_000);
            }, waitTime + 200);
        })();

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, []);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteGoal(deleteTarget.id);
        await loadGoals();
        setDeleteTarget(null);
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                <Typography component="h2" variant="h6">투자 목표</Typography>
                <BlindToggle/>
                <Tooltip title="매시 정각에 목표 달성 여부를 확인하여 알림이 발송됩니다." placement="right">
                    <HelpOutlineIcon sx={{fontSize: 16, color: 'text.secondary'}}/>
                </Tooltip>
                <Box sx={{flex: 1}}/>
                {!loading && goals.length < 3 && (
                    <Button size="small" variant="contained" startIcon={<AddIcon/>} onClick={() => { setEditGoal(null); setGoalDialogOpen(true); }}>
                        목표 추가
                    </Button>
                )}
            </Box>

            {lastUpdated && !loading && (
                <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 1}}>
                    <Typography variant="caption" color="text.secondary">
                        {lastUpdated.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} 기준
                    </Typography>
                </Box>
            )}

            {loading ? (
                <Stack spacing={2}>
                    {[0, 1, 2].map((i) => (
                        <Card variant="outlined" key={i}>
                            <CardContent>
                                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                                    <Skeleton width={140} height={28}/>
                                    <Skeleton variant="circular" width={24} height={24}/>
                                </Box>
                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                                    <Skeleton variant="rounded" sx={{flex: 1, height: 10, borderRadius: 5}}/>
                                    <Skeleton width={50}/>
                                </Box>
                                <Skeleton width={220}/>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            ) : goals.length > 0 ? (
                <Stack spacing={2}>
                    {goals.map((goal) => {
                        const rate = Math.min(goal.achievementRate, 100);
                        const isOver = goal.achievementRate >= 100;
                        return (
                            <Card variant="outlined" key={goal.id}>
                                <CardContent>
                                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                                {goalTypeLabel[goal.type]}
                                            </Typography>
                                            {isOver && <Chip label="달성 완료" size="small" color="success" variant="outlined"/>}
                                        </Box>
                                        <IconButton size="small" onClick={(e) => { setAnchorEl(e.currentTarget); setMenuTarget(goal); }}>
                                            <MoreVertIcon fontSize="small"/>
                                        </IconButton>
                                    </Box>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={rate}
                                            color={isOver ? 'success' : 'primary'}
                                            sx={{flex: 1, height: 10, borderRadius: 5}}
                                        />
                                        <Typography variant="body2" sx={{fontWeight: 700, minWidth: 50, textAlign: 'right'}}>
                                            {goal.achievementRate.toFixed(1)}%
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        <BlindText>{goal.currentAmount.toLocaleString()}원 / {goal.targetAmount.toLocaleString()}원</BlindText>
                                    </Typography>
                                    {isOver && (
                                        <Alert severity="success" sx={{mt: 1.5, py: 0}} variant="outlined">
                                            목표를 달성했습니다! 새로운 목표를 설정해보세요.
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            ) : (
                <Card variant="outlined">
                    <CardContent sx={{textAlign: 'center', py: 4}}>
                        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                            설정된 투자 목표가 없습니다.
                        </Typography>
                        <Button variant="outlined" startIcon={<AddIcon/>} onClick={() => { setEditGoal(null); setGoalDialogOpen(true); }}>
                            첫 번째 목표 설정하기
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => { setEditGoal(menuTarget); setGoalDialogOpen(true); setAnchorEl(null); }}>
                    <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>{menuTarget && menuTarget.achievementRate >= 100 ? '새 목표 설정' : '수정'}</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { setDeleteTarget(menuTarget); setAnchorEl(null); }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error"/></ListItemIcon>
                    <ListItemText>삭제</ListItemText>
                </MenuItem>
            </Menu>

            <GoalSettingDialog
                open={goalDialogOpen}
                onClose={() => { setGoalDialogOpen(false); setEditGoal(null); }}
                onSaved={loadGoals}
                editGoal={editGoal}
                existingTypes={goals.map(g => g.type)}
            />

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>투자 목표 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        <b>{deleteTarget ? goalTypeLabel[deleteTarget.type] : ''}</b>을(를) 삭제하시겠습니까?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button color="error" onClick={handleDelete}>삭제</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
