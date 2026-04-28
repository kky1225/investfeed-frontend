import {useEffect, useState} from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import LinkIcon from "@mui/icons-material/Link";
import {fetchBrokerList, addMyBroker} from "../../api/broker/BrokerApi.ts";
import type {Broker} from "../../type/BrokerType.ts";
import {useApiKeyStatus} from "../../context/ApiKeyStatusContext.tsx";

interface AddBrokerDialogProps {
    open: boolean;
    onClose: () => void;
}

export default function AddBrokerDialog({open, onClose}: AddBrokerDialogProps) {
    // 본인이 이미 추가한 broker 는 Context 에서 직접 가져옴 (parent 가 prop 으로 전달 불필요)
    const {myStockBrokers, invalidateMyStockBrokers} = useApiKeyStatus();
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [error, setError] = useState("");

    const myBrokerIds = new Set(myStockBrokers.map(b => b.brokerId));

    useEffect(() => {
        if (!open) return;
        (async () => {
            try {
                const data = await fetchBrokerList();
                const all: Broker[] = data.result?.brokers ?? [];
                setBrokers(all.filter(b => b.market === 'STOCK'));
            } catch (error) {
                console.error(error);
                setBrokers([]);
            }
        })();
    }, [open]);

    const handleSelect = async (broker: Broker) => {
        try {
            setError("");
            await addMyBroker({brokerId: broker.id});
            await invalidateMyStockBrokers();   // Context 갱신 = parent 페이지 자동 재렌더
            onClose();
        } catch (error) {
            console.error(error);
            setError("증권사 추가에 실패했습니다.");
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>증권사 추가</DialogTitle>
            <DialogContent>
                {brokers.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{py: 2, textAlign: 'center'}}>
                        등록된 증권사가 없습니다.
                    </Typography>
                ) : (
                    <List dense disablePadding>
                        {brokers.map(broker => {
                            const alreadyAdded = myBrokerIds.has(broker.id);
                            return (
                                <ListItemButton
                                    key={broker.id}
                                    onClick={() => handleSelect(broker)}
                                    disabled={alreadyAdded}
                                >
                                    <ListItemText
                                        primary={broker.name}
                                        secondary={broker.type === "API" ? "API 연동" : "수동 입력"}
                                    />
                                    {broker.type === "API" && <LinkIcon fontSize="small" sx={{mr: 1, color: 'text.secondary'}}/>}
                                    {alreadyAdded && <Chip label="추가됨" size="small" variant="outlined"/>}
                                </ListItemButton>
                            );
                        })}
                    </List>
                )}
                {error && (
                    <Typography variant="caption" color="error" sx={{mt: 1, display: 'block'}}>{error}</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>닫기</Button>
            </DialogActions>
        </Dialog>
    );
}
