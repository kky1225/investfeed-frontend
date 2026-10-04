import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function AssistantBubble({text}: { text: string }) {
    return (
        <Stack alignItems="flex-start">
            <Box sx={{maxWidth: '85%', px: 1.75, py: 1, borderRadius: 3, bgcolor: 'action.hover', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                <Typography variant="body2">{text}</Typography>
            </Box>
        </Stack>
    );
}
