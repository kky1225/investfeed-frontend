import {useMemo, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import CloseIcon from "@mui/icons-material/Close";
import {removeMyBroker} from "../../api/broker/BrokerApi.ts";
import type {MemberBroker} from "../../type/BrokerType.ts";
import HoldingList from "./HoldingList.tsx";
import ManualHoldingTab from "./ManualHoldingTab.tsx";
import AddBrokerDialog from "./AddBrokerDialog.tsx";
import BlindToggle from "../../components/BlindToggle.tsx";
import RealizedPnlTab from "./RealizedPnlTab.tsx";
import ApiKeyRequiredEmptyState from "../../components/ApiKeyRequiredEmptyState.tsx";
import {useQueryClient} from "@tanstack/react-query";
import {useApiKeyStatus, apiKeyStatusKeys} from "../../context/ApiKeyStatusContext.tsx";

export default function HoldingPage() {
    const navigate = useNavigate();
    const {brokerId} = useParams<{brokerId?: string}>();
    const {myStockBrokers, isBrokerValid} = useApiKeyStatus();
    const queryClient = useQueryClient();
    const [selectedTab, setSelectedTab] = useState(0);
    const [addBrokerOpen, setAddBrokerOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<MemberBroker | null>(null);
    const [mainTab, setMainTab] = useState(0);

    const myBrokers = useMemo(
        () => myStockBrokers
            .filter(b => b.market === 'STOCK')
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex),
        [myStockBrokers]
    );

    // URL brokerId / broker 목록 변화에 selectedTab 동기화 — render 중 비교 패턴
    // 초기값 sentinel("") 사용 — 첫 렌더에서도 동기화 트리거 (원래 useEffect 가 마운트 후 한 번 실행됐던 것과 동일)
    const syncKey = `${brokerId ?? ''}|${myBrokers.map(b => b.id).join(',')}`;
    const [prevSyncKey, setPrevSyncKey] = useState<string>('__INITIAL__');
    if (syncKey !== prevSyncKey) {
        setPrevSyncKey(syncKey);
        if (myBrokers.length > 0) {
            if (brokerId) {
                const index = myBrokers.findIndex(b => b.id === Number(brokerId));
                setSelectedTab(index >= 0 ? index : 0);
            } else {
                setSelectedTab(0);
            }
        }
    }

    const handleTabChange = (_: unknown, index: number) => {
        const broker = myBrokers[index];
        if (broker) {
            navigate(`/stock/holding/list/${broker.id}`, {replace: true});
        }
    };

    const handleRemoveBroker = async () => {
        if (!deleteTarget) return;
        try {
            const res = await removeMyBroker(deleteTarget.id);
            if (res.code !== "0000") throw new Error(res.message || `증권사 삭제 실패 (${res.code})`);
            await queryClient.invalidateQueries({queryKey: apiKeyStatusKeys.myStockBrokers});
            navigate('/stock/holding/list', {replace: true});
        } catch (err) {
            console.error(err);
        }
        setDeleteTarget(null);
    };

    const renderTabContent = () => {
        const broker = myBrokers[selectedTab];
        if (!broker) return null;

        if (broker.type === "API") {
            if (!isBrokerValid(broker.brokerId)) {
                return <ApiKeyRequiredEmptyState brokerName={broker.name}/>;
            }
            return <HoldingList/>;
        }

        return <ManualHoldingTab broker={broker}/>;
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                <Typography component="h2" variant="h6">
                    주식 계좌
                </Typography>
                <BlindToggle/>
            </Box>

            {/* 상위 탭: 주식 계좌 | 실현손익 */}
            <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{mb: 2}}>
                <Tab label="주식 계좌"/>
                <Tab label="실현손익"/>
            </Tabs>

            {mainTab === 1 ? (
                <RealizedPnlTab myBrokers={myBrokers}/>
            ) : (
                <>
                    <Box sx={{display: 'flex', alignItems: 'center', mb: 2, borderBottom: 1, borderColor: 'divider'}}>
                        <Tabs
                            value={selectedTab}
                            onChange={handleTabChange}
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
                                            <CloseIcon
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteTarget(broker);
                                                }}
                                                sx={{fontSize: 18, ml: 0.5, cursor: 'pointer', color: 'text.disabled', '&:hover': {color: 'error.main'}}}
                                            />
                                        </Stack>
                                    }
                                />
                            ))}
                        </Tabs>
                        <Button
                            size="small"
                            startIcon={<AddIcon/>}
                            onClick={() => setAddBrokerOpen(true)}
                            sx={{ml: 1, whiteSpace: 'nowrap', flexShrink: 0}}
                        >
                            추가
                        </Button>
                    </Box>

                    {renderTabContent()}
                </>
            )}

            <AddBrokerDialog
                open={addBrokerOpen}
                onClose={() => setAddBrokerOpen(false)}
            />

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>증권사 제거</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        <b>{deleteTarget?.name}</b>을(를) 제거하시겠습니까?
                        <br/>
                        해당 증권사의 모든 보유주식도 함께 삭제됩니다.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button color="error" onClick={handleRemoveBroker}>제거</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
