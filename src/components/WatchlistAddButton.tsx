import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import {addWatchlistItem, fetchWatchlistGroups} from "../api/watchlist/WatchlistApi.ts";
import {requireOk} from "../lib/apiResponse.ts";
import {useAlert} from "../context/AlertContext";
import {WatchlistGroup} from "../type/WatchlistType.ts";

/**
 * 종목 상세 우측 상단 "관심종목 추가" 하트 + 그룹 선택 다이얼로그. 국내·미국 종목 상세가 같이 쓴다 (2026-11-11 국내 상세에서 분리).
 * stexTp: 미국 거래소(ND/NY/NA). 국내는 비운다
 * groupIds: 이 종목이 이미 들어 있는 관심 그룹(상세 응답의 watchlistGroupIds). 하트를 채우고, 그 그룹은 다시 추가하지 못하게 한다
 */
export default function WatchlistAddButton({stkCd, stkNm, stexTp, groupIds}: {
    stkCd: string; stkNm: string; stexTp?: string; groupIds?: number[];
}) {
    const [open, setOpen] = useState(false);
    const [groups, setGroups] = useState<WatchlistGroup[]>([]);
    const [loading, setLoading] = useState(false);
    // 이 화면에서 방금 추가한 그룹. 상세 응답이 다음 조회에서 알려 주기 전까지 하트를 채워 둔다
    const [justAdded, setJustAdded] = useState<{key: string, ids: Set<number>}>({key: '', ids: new Set()});
    const stockKey = `${stexTp ?? ''}|${stkCd}`;
    // 다른 종목으로 바뀌면 방금 추가한 그룹은 잊는다
    if (justAdded.key !== stockKey) setJustAdded({key: stockKey, ids: new Set()});
    const addedGroupIds = new Set([...(groupIds ?? []), ...(justAdded.key === stockKey ? justAdded.ids : [])]);
    const showAlert = useAlert();
    const queryClient = useQueryClient();

    const handleHeartClick = async () => {
        setOpen(true);
        setLoading(true);
        try {
            const res = await fetchWatchlistGroups();
            if (res.code !== "0000") throw new Error(res.message || `관심 그룹 조회 실패 (${res.code})`);
            setGroups(res.result ?? []);
        } finally {
            setLoading(false);
        }
    };

    const addToGroupMutation = useMutation({
        mutationFn: async (group: WatchlistGroup) => {
            requireOk(await addWatchlistItem(group.id, {stkCd, stkNm, stexTp}), '관심 종목 추가');
            return group;
        },
        onSuccess: (group) => {
            setJustAdded(prev => ({key: prev.key, ids: new Set(prev.ids).add(group.id)}));
            // 받아 둔 상세 응답은 추가 전 것이다. 다른 화면에 다녀와 그 응답을 다시 쓰면 하트가 비어 보이므로 낡았다고 표시해 둔다.
            // 지금 열린 상세를 바로 다시 부르지는 않는다(방금 추가한 그룹은 justAdded 가 채운다).
            queryClient.invalidateQueries({queryKey: [stexTp ? 'usStockDetail' : 'stockDetail'], refetchType: 'none'});
            showAlert(`${group.groupNm}에 추가되었습니다.`, 'success');
        },
        onError: (error) => {
            console.error(error);
            showAlert('이미 추가된 종목이거나 오류가 발생했습니다.', 'error');
        },
    });

    return (
        <>
            <Tooltip title="관심종목 추가">
                <IconButton size="small" onClick={handleHeartClick} sx={{mb: "3px"}}>
                    {addedGroupIds.size > 0
                        ? <FavoriteIcon fontSize="small" color="error" />
                        : <FavoriteBorderIcon fontSize="small" color="error" />
                    }
                </IconButton>
            </Tooltip>

            {/* 관심종목 그룹 선택 다이얼로그 */}
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>관심종목에 추가</DialogTitle>
                <DialogContent sx={{pb: 1}}>
                    {loading ? (
                        <Box sx={{display: 'flex', justifyContent: 'center', py: 3}}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : groups.length === 0 ? (
                        <Box sx={{py: 2, textAlign: 'center'}}>
                            <Typography variant="body2" color="text.secondary">
                                관심종목 그룹이 없습니다.
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                관심종목 메뉴에서 그룹을 먼저 만들어주세요.
                            </Typography>
                        </Box>
                    ) : (
                        <List dense disablePadding>
                            {groups.map(group => (
                                <ListItemButton
                                    key={group.id}
                                    onClick={() => addToGroupMutation.mutate(group)}
                                    disabled={addedGroupIds.has(group.id)}
                                    sx={{borderRadius: 1}}
                                >
                                    <ListItemText
                                        primary={group.groupNm}
                                        primaryTypographyProps={{variant: 'body2'}}
                                    />
                                    {addedGroupIds.has(group.id) && (
                                        <FavoriteIcon fontSize="small" color="error" />
                                    )}
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>닫기</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
