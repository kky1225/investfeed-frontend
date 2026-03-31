import {useState, useMemo, useCallback} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import BackspaceIcon from '@mui/icons-material/Backspace';

interface SecurityKeypadProps {
    length?: number;
    onComplete: (code: string) => void;
    disabled?: boolean;
}

export default function SecurityKeypad({length = 6, onComplete, disabled = false}: SecurityKeypadProps) {
    const [code, setCode] = useState('');

    const shuffledNumbers = useMemo(() => {
        const nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = nums.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nums[i], nums[j]] = [nums[j], nums[i]];
        }
        return nums;
    }, []);

    const handleNumber = useCallback((num: number) => {
        if (disabled) return;
        setCode(prev => {
            const next = prev + num;
            if (next.length === length) {
                setTimeout(() => onComplete(next), 0);
            }
            return next.length <= length ? next : prev;
        });
    }, [disabled, length, onComplete]);

    const handleDelete = useCallback(() => {
        if (disabled) return;
        setCode(prev => prev.slice(0, -1));
    }, [disabled]);

    const dots = Array.from({length}, (_, i) => (
        <Box
            key={i}
            sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: i < code.length ? 'primary.main' : 'divider',
                bgcolor: i < code.length ? 'primary.main' : 'transparent',
                mx: 0.5,
            }}
        />
    ));

    const buttonSx = {
        width: 64,
        height: 64,
        borderRadius: '50%',
        fontSize: '1.3rem',
        fontWeight: 600,
        minWidth: 0,
    };

    const topRow = shuffledNumbers.slice(0, 3);
    const midRow = shuffledNumbers.slice(3, 6);
    const botRow = shuffledNumbers.slice(6, 9);
    const lastNum = shuffledNumbers[9];

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
            <Box sx={{display: 'flex', justifyContent: 'center', mb: 1}}>
                {dots}
            </Box>

            {[topRow, midRow, botRow].map((row, idx) => (
                <Box key={idx} sx={{display: 'flex', gap: 2, justifyContent: 'center'}}>
                    {row.map(num => (
                        <Button key={num} variant="outlined" sx={buttonSx} onClick={() => handleNumber(num)} disabled={disabled}>
                            {num}
                        </Button>
                    ))}
                </Box>
            ))}

            <Box sx={{display: 'flex', gap: 2, justifyContent: 'center'}}>
                <Box sx={{width: 64, height: 64}} />
                <Button variant="outlined" sx={buttonSx} onClick={() => handleNumber(lastNum)} disabled={disabled}>
                    {lastNum}
                </Button>
                <Button variant="outlined" sx={{...buttonSx, fontSize: '1rem'}} onClick={handleDelete} disabled={disabled}>
                    <BackspaceIcon fontSize="small" />
                </Button>
            </Box>

            <Typography variant="caption" color="text.secondary">
                {length}자리 비밀번호를 입력하세요
            </Typography>
        </Box>
    );
}
