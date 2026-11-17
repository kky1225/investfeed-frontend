import type {Theme} from "@mui/material/styles";

// 차트가 쓰는 색. 테마 색을 CSS 변수로 풀어 두고, 캔버스(엔진)와 색 단추(꾸미기 패널, 설정 창)가 같은 값을 쓴다.

/**
 * 선 색의 CSS 변수. 순서가 곧 색 순번이다(이동평균선, 지표, 그린 도형이 이 순번으로 색을 고르고 저장한다).
 * 순서를 바꾸거나 중간에 끼워 넣으면 저장된 색이 달라지므로, 늘릴 때는 뒤에 붙인다.
 */
export const LINE_COLOR_VARS = [
    '--chart-line-1', '--chart-line-2', '--chart-line-3', '--chart-line-4', '--chart-line-5', '--chart-line-6',
];

/**
 * 차트 색 변수의 정의. 차트 영역에 걸어 두면 그 안에서 var(--chart-…) 로 쓸 수 있다.
 * 창이나 메뉴처럼 화면 다른 곳에 따로 그려지는 것에는 그 뿌리에 한 번 더 걸어야 한다.
 */
export const chartColorVars = (theme: Theme) => ({
    '--chart-up': (theme.vars || theme).palette.error.main,
    // 하락색은 info.main 대신 primary.main 을 쓴다. 라이트 모드의 info.main 은 밝은 하늘색이라
    // 진한 빨강(error.main)과 무게가 맞지 않고 캔들이 흐려 보인다
    '--chart-down': (theme.vars || theme).palette.primary.main,
    // 글자로 적을 때의 상승색·하락색. 라이트 모드에서는 캔들 색과 같다.
    '--chart-up-text': (theme.vars || theme).palette.error.main,
    '--chart-down-text': (theme.vars || theme).palette.primary.main,
    // 다크 모드의 error.main 은 어두운 빨강이라 어두운 배경 위의 글자로는 읽기 어렵다. 캔들은 그대로 두고
    // 글자만 밝게 한다: 빨강은 error.light 에 글자색을 섞고, 파랑은 primary.light 를 쓴다
    ...theme.applyStyles('dark', {
        '--chart-up-text': `color-mix(in srgb, ${(theme.vars || theme).palette.error.light} 65%, ${(theme.vars || theme).palette.text.primary})`,
        '--chart-down-text': (theme.vars || theme).palette.primary.light,
    }),
    '--chart-text': (theme.vars || theme).palette.text.secondary,
    '--chart-grid': (theme.vars || theme).palette.divider,
    '--chart-background': (theme.vars || theme).palette.background.paper,
    '--chart-line-1': (theme.vars || theme).palette.success.main,
    '--chart-line-2': (theme.vars || theme).palette.warning.main,
    '--chart-line-3': (theme.vars || theme).palette.secondary.main,
    '--chart-line-4': (theme.vars || theme).palette.grey[500],
    '--chart-line-5': (theme.vars || theme).palette.text.primary,
    '--chart-line-6': (theme.vars || theme).palette.info.main,
});
