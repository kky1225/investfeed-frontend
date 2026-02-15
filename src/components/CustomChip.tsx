import Chip from "@mui/material/Chip";

function CustomChip (status: number) {
    const colors = status == 0 ? 'default' : status > 0 ? 'error': 'info';

    return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
}

export default CustomChip;

