import {useEffect, useState} from "react";
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
import {fetchMyBrokerList, removeMyBroker} from "../../api/broker/BrokerApi.ts";
import type {MemberBroker} from "../../type/BrokerType.ts";
import HoldingList from "./HoldingList.tsx";
import ManualHoldingTab from "./ManualHoldingTab.tsx";
import AddBrokerDialog from "./AddBrokerDialog.tsx";

export default function HoldingPage() {
    const navigate = useNavigate();
    const {brokerId} = useParams<{brokerId?: string}>();
    const [myBrokers, setMyBrokers] = useState<MemberBroker[]>([]);
    const [selectedTab, setSelectedTab] = useState(0);
    const [addBrokerOpen, setAddBrokerOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<MemberBroker | null>(null);

    const loadMyBrokers = async () => {
        try {
            const data = await fetchMyBrokerList();
            const list: MemberBroker[] = data.result?.brokers ?? [];
            const stockBrokers = list.filter(b => b.market === 'STOCK');
            stockBrokers.sort((a, b) => a.orderIndex - b.orderIndex);
            setMyBrokers(stockBrokers);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadMyBrokers();
    }, []);

    useEffect(() => {
        if (myBrokers.length === 0) return;
        if (brokerId) {
            const index = myBrokers.findIndex(b => b.id === Number(brokerId));
            setSelectedTab(index >= 0 ? index : 0);
        } else {
            setSelectedTab(0);
        }
    }, [brokerId, myBrokers]);

    const handleTabChange = (_: unknown, index: number) => {
        const broker = myBrokers[index];
        if (broker) {
            navigate(`/stock/holding/list/${broker.id}`, {replace: true});
        }
    };

    const handleRemoveBroker = async () => {
        if (!deleteTarget) return;
        try {
            await removeMyBroker(deleteTarget.id);
            await loadMyBrokers();
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
            return <HoldingList/>;
        }

        return <ManualHoldingTab broker={broker}/>;
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                보유 주식
            </Typography>

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

            <AddBrokerDialog
                open={addBrokerOpen}
                onClose={() => setAddBrokerOpen(false)}
                myBrokers={myBrokers}
                onAdded={loadMyBrokers}
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
