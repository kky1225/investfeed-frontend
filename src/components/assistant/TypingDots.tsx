import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';

/**
 * 답변 대기 표시: 비서 말풍선(AssistantBubble) 모양 안에서 점 세 개가 차례로 튄다 (2026-10-04, "조회 중…" 문구 대체).
 * 움직임을 줄이도록 설정한 사용자에게는 애니메이션 없이 점만 보인다.
 */
export default function TypingDots() {
    return (
        <Stack alignItems="flex-start">
            <Box
                role="status"
                aria-label="답변을 준비하고 있습니다"
                sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1.75, py: 1.25, borderRadius: 3, bgcolor: 'action.hover',
                    '@keyframes assistantTypingDot': {
                        '0%, 60%, 100%': {transform: 'translateY(0)', opacity: 0.4},
                        '30%': {transform: 'translateY(-4px)', opacity: 1},
                    },
                }}
            >
                {[0, 1, 2].map((i) => (
                    <Box
                        key={i}
                        sx={{
                            width: 7, height: 7, borderRadius: '50%', bgcolor: 'text.secondary',
                            animation: 'assistantTypingDot 1.2s ease-in-out infinite',
                            animationDelay: `${i * 0.15}s`,
                            '@media (prefers-reduced-motion: reduce)': {animation: 'none', opacity: 0.6},
                        }}
                    />
                ))}
            </Box>
        </Stack>
    );
}
