import {useState} from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import {formatAlertPrice} from "../../components/CustomRender.tsx";
import type {PriceTarget, PriceTargetDirection} from "../../type/NotificationType.ts";

/** 차트에서 목표가 선을 끌어 놓은 결과: 어느 목표가를 얼마로, 어느 방향으로 바꿀지 */
export interface PriceTargetMove {
    target: PriceTarget,
    price: number,
    direction: PriceTargetDirection,
}

interface PriceTargetMoveDialogProps {
    move: PriceTargetMove | null,   // null 이면 닫혀 있다
    saving: boolean,
    failed: boolean,                // 저장에 실패했는지
    onPriceChange: (price: number) => void,    // 창에서 가격을 고쳐 적었을 때
    onConfirm: () => void,
    onCancel: () => void,
}

const directionText = (direction: PriceTargetDirection) => direction === 'ABOVE' ? '이상' : '이하';

/** 창의 내용. 창이 열릴 때마다 새로 만들어져, 입력 칸이 끌어 놓은 가격으로 시작한다. */
const MoveFields = ({move, saving, failed, onPriceChange, onConfirm, onCancel}: PriceTargetMoveDialogProps & { move: PriceTargetMove }) => {
    // 끌어서는 정확한 값에 놓기 어려우므로 숫자를 고쳐 적을 수 있게 한다.
    const [input, setInput] = useState(String(move.price));
    const parsed = Number(input);
    const valid = input.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
    const changeInput = (text: string) => {
        setInput(text);
        const price = Number(text);
        if (text.trim() !== '' && Number.isFinite(price) && price > 0) onPriceChange(price);
    };

    return (
        <>
            <DialogContent>
                <TextField
                    label="새 목표가"
                    value={input}
                    onChange={event => changeInput(event.target.value)}
                    // 열리면 값을 선택해 두어, 바로 숫자를 치면 통째로 바뀐다.
                    onFocus={event => event.target.select()}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && valid && !saving) onConfirm();
                    }}
                    error={!valid}
                    helperText={valid ? undefined : '목표가를 입력해주세요.'}
                    autoFocus
                    fullWidth
                    size="small"
                    slotProps={{htmlInput: {inputMode: 'decimal'}}}
                    sx={{mt: 1, mb: 2}}
                />
                <DialogContentText>
                    {formatAlertPrice(move.target.targetPrice, move.target.assetCode)} {directionText(move.target.direction)}
                    {' → '}
                    {formatAlertPrice(move.price, move.target.assetCode)} {directionText(move.direction)}
                </DialogContentText>
                {failed && (
                    <DialogContentText color="error" sx={{mt: 1}}>
                        목표가를 바꾸지 못했습니다. 잠시 후 다시 시도해주세요.
                    </DialogContentText>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>취소</Button>
                <Button variant="contained" onClick={onConfirm} loading={saving} disabled={!valid}>변경</Button>
            </DialogActions>
        </>
    );
};

/**
 * 차트에서 목표가 선을 끌어 놓았을 때 띄우는 확인 창. 잘못 끌어 알림 가격이 바뀌는 일을 막고,
 * 끌어 놓은 가격을 숫자로 고쳐 적을 수 있다.
 */
const PriceTargetMoveDialog = (props: PriceTargetMoveDialogProps) => (
    <Dialog open={props.move !== null} onClose={props.onCancel} maxWidth="xs" fullWidth>
        <DialogTitle>목표가 변경</DialogTitle>
        {props.move && <MoveFields key={props.move.target.id} {...props} move={props.move}/>}
    </Dialog>
);

export default PriceTargetMoveDialog;
