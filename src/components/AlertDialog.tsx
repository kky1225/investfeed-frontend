import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {alpha} from '@mui/material/styles';
import {useAlertContext} from '../context/AlertContext';

const SEVERITY_CONFIG = {
    success: {color: 'success.main', icon: CheckCircleOutlineIcon, title: '완료'},
    error:   {color: 'error.main',   icon: ErrorOutlineIcon,        title: '오류'},
    info:    {color: 'info.main',    icon: InfoOutlinedIcon,        title: '안내'},
    warning: {color: 'warning.main', icon: WarningAmberIcon,        title: '주의'},
} as const;

export default function AlertDialog() {
    const {alert, hideAlert} = useAlertContext();
    const config = SEVERITY_CONFIG[alert.severity];
    const Icon = config.icon;

    return (
        <Dialog
            open={alert.open}
            onClose={hideAlert}
            maxWidth="xs"
            fullWidth
            slotProps={{paper: {sx: {borderRadius: 3}}}}
        >
            <DialogContent sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pt: 4, pb: 2}}>
                <Box sx={{
                    width: 56, height: 56, borderRadius: '50%',
                    bgcolor: (theme) => alpha(theme.palette[alert.severity === 'success' ? 'success' : alert.severity === 'error' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'].main, 0.12),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2
                }}>
                    <Icon sx={{color: config.color, fontSize: 28}}/>
                </Box>
                <Typography variant="h6" sx={{fontWeight: 600, mb: 1}}>{config.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{lineHeight: 1.6, whiteSpace: 'pre-wrap'}}>
                    {alert.message}
                </Typography>
            </DialogContent>
            <DialogActions sx={{px: 3, pb: 3, pt: 0}}>
                <Button fullWidth variant="contained" onClick={hideAlert} autoFocus>
                    확인
                </Button>
            </DialogActions>
        </Dialog>
    );
}
