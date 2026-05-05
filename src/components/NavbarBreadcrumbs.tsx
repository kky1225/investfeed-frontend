import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { useLocation } from 'react-router-dom';
import { useMenuTree } from '../context/MenuContext';
import type { MenuRes } from '../type/MenuType';

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
    margin: theme.spacing(1, 0),
    [`& .${breadcrumbsClasses.separator}`]: {
        color: (theme.vars || theme).palette.action.disabled,
        margin: 1,
    },
    [`& .${breadcrumbsClasses.ol}`]: {
        alignItems: 'center',
    },
}));

// 메뉴 트리에서 url 과 일치하는 노드까지의 부모 체인을 [상위, ..., 현재] 순서로 반환
const findMenuPath = (menus: MenuRes[], pathname: string, parents: MenuRes[] = []): MenuRes[] => {
    for (const menu of menus) {
        const trail = [...parents, menu];
        if (menu.url && menu.url === pathname) return trail;
        const childTrail = findMenuPath(menu.children, pathname, trail);
        if (childTrail.length > 0) return childTrail;
    }
    return [];
};

// 메뉴에 정의되지 않은 동적/설정 페이지의 폴백 매핑
const fallbackBreadcrumb = (pathname: string): string[] | null => {
    if (pathname.startsWith('/stock/detail/')) return ['국내 주식', '종목 상세'];
    if (pathname.startsWith('/crypto/detail/')) return ['암호화폐', '종목 상세'];
    if (pathname === '/settings/profile') return ['설정', '회원정보 수정'];
    if (pathname === '/settings/change-password') return ['설정', '비밀번호 변경'];
    if (pathname === '/settings/api-keys') return ['설정', 'API Key 관리'];
    if (pathname.startsWith('/settings/')) return ['설정'];
    if (pathname === '/notification/settings') return ['알림', '알림 설정'];
    return null;
};

export default function NavbarBreadcrumbs() {
    const location = useLocation();
    const { menuTree } = useMenuTree();

    const matchedTrail = findMenuPath(menuTree, location.pathname);
    const labels: string[] = matchedTrail.length > 0
        ? matchedTrail.map((m) => m.name)
        : (fallbackBreadcrumb(location.pathname) ?? ['홈']);

    return (
        <StyledBreadcrumbs
            aria-label="breadcrumb"
            separator={<NavigateNextRoundedIcon fontSize="small" />}
        >
            {labels.map((label, idx) => {
                const isLast = idx === labels.length - 1;
                return (
                    <Typography
                        key={`${label}-${idx}`}
                        variant="body1"
                        sx={isLast ? { color: 'text.primary', fontWeight: 600 } : undefined}
                    >
                        {label}
                    </Typography>
                );
            })}
        </StyledBreadcrumbs>
    );
}
