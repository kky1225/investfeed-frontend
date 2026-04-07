import Box from "@mui/material/Box";
import {useBlindMode} from "../context/BlindModeContext.tsx";
import {ReactNode} from "react";

interface BlindTextProps {
    children: ReactNode;
}

export default function BlindText({children}: BlindTextProps) {
    const {isBlind} = useBlindMode();

    if (!isBlind) return <>{children}</>;

    return (
        <Box
            component="span"
            sx={{
                filter: 'blur(8px)',
                userSelect: 'none',
            }}
        >
            {children}
        </Box>
    );
}
