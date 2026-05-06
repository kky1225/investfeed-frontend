import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
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
import {fetchCryptoBrokerList, addMyCryptoBroker} from "../../api/cryptoBroker/CryptoBrokerApi.ts";
import type {Broker} from "../../type/BrokerType.ts";
import {useApiKeyStatus, apiKeyStatusKeys} from "../../context/ApiKeyStatusContext.tsx";
import {requireOk} from "../../lib/apiResponse.ts";

interface AddCryptoBrokerDialogProps {
    open: boolean;
    onClose: () => void;
}

export default function AddCryptoBrokerDialog({open, onClose}: AddCryptoBrokerDialogProps) {
    // 본인이 이미 추가한 broker 는 Context 에서 직접 가져옴 (parent 가 prop 으로 전달 불필요)
    const {myCryptoBrokers} = useApiKeyStatus();
    const queryClient = useQueryClient();
    const [error, setError] = useState("");

    const myBrokerIds = new Set(myCryptoBrokers.map(b => b.brokerId));

    const {data: brokersData} = useQuery<Broker[]>({
        queryKey: ['cryptoBrokerList'],
        queryFn: async ({signal}) => requireOk(await fetchCryptoBrokerList({signal, skipGlobalError: true}), {brokers: [] as Broker[]}).brokers ?? [],
        enabled: open,
    });
    const brokers = brokersData ?? [];

    const handleSelect = async (broker: Broker) => {
        try {
            setError("");
            const res = await addMyCryptoBroker({brokerId: broker.id});
            if (res.code !== "0000") throw new Error(res.message || `거래소 추가 실패 (${res.code})`);
            await queryClient.invalidateQueries({queryKey: apiKeyStatusKeys.myCryptoBrokers});
            onClose();
        } catch (error) {
            console.error(error);
            setError("거래소 추가에 실패했습니다.");
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>거래소 추가</DialogTitle>
            <DialogContent>
                {brokers.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{py: 2, textAlign: 'center'}}>
                        등록된 거래소가 없습니다.
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
