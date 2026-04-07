import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {useBlindMode} from "../context/BlindModeContext.tsx";

export default function BlindToggle() {
    const {isBlind, toggleBlind} = useBlindMode();

    return (
        <Tooltip title={isBlind ? "금액 표시" : "금액 숨기기"}>
            <IconButton size="small" onClick={toggleBlind} sx={{color: 'text.secondary'}}>
                {isBlind ? <VisibilityOffIcon fontSize="small"/> : <VisibilityIcon fontSize="small"/>}
            </IconButton>
        </Tooltip>
    );
}
