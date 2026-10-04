import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

/** 삭제 확인 — 앱의 기존 삭제 확인 창(API Key 삭제 등)과 같은 모양: 취소 · 빨간 삭제 */
export default function DeleteConfirmDialog({open, title, message, pending, onCancel, onConfirm}: {
    open: boolean;
    title: string;
    message: string;
    pending?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <Dialog open={open} onClose={onCancel} disableScrollLock>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{whiteSpace: 'pre-line'}}>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>취소</Button>
                <Button onClick={onConfirm} disabled={pending} variant="contained" sx={{bgcolor: '#d32f2f', '&:hover': {bgcolor: '#b71c1c'}}}>삭제</Button>
            </DialogActions>
        </Dialog>
    );
}
