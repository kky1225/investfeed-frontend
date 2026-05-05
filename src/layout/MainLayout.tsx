import CssBaseline from "@mui/material/CssBaseline";
import AppTheme from "../components/AppTheme.tsx";
import {dataGridCustomizations} from "../components/customizations/dataGrid.ts";
import {chartsCustomizations} from "../components/customizations/chart.ts";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import SideMenu from "../components/SideMenu.tsx";
import AppNavbar from "../components/AppNavbar.tsx";
import Box from "@mui/material/Box";
import {alpha} from "@mui/material/styles";
import Header from "../components/Header.tsx";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import {useEffect} from "react";
import {useApiKeyStatus} from "../context/ApiKeyStatusContext.tsx";
import {useMenuTree} from "../context/MenuContext.tsx";
import type {MenuRes} from "../type/MenuType";

const xThemeComponents = {
    ...dataGridCustomizations,
    ...chartsCustomizations
};

const findMenuByUrl = (menus: MenuRes[], url: string): MenuRes | null => {
    for (const menu of menus) {
        if (menu.url === url) return menu;
        const child = findMenuByUrl(menu.children, url);
        if (child) return child;
    }
    return null;
};

const collectMenuBrokerIds = (menus: MenuRes[]): number[] =>
    menus.flatMap((m) => [...m.requiredBrokerIds, ...collectMenuBrokerIds(m.children)]);

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {apiBrokers, validBrokerIds, myApiBrokerIds, isLoaded: apiKeyLoaded, isSatisfied} = useApiKeyStatus();
    const {menuTree, menuLoaded} = useMenuTree();

    useEffect(() => {
        if (!apiKeyLoaded || !menuLoaded) return;
        const menu = findMenuByUrl(menuTree, location.pathname);
        if (!menu) return;
        if (!isSatisfied(menu.requiredBrokerIds)) {
            navigate('/settings/api-keys', {replace: true});
        }
    }, [location.pathname, menuTree, menuLoaded, apiKeyLoaded, isSatisfied, navigate]);

    const usedBrokerIds = new Set<number>([
        ...collectMenuBrokerIds(menuTree),
        ...myApiBrokerIds,
    ]);
    const missingBrokerNames = apiBrokers
        .filter((b) => usedBrokerIds.has(b.id) && !validBrokerIds.has(b.id))
        .map((b) => b.name);
    const showApiKeyAlert = apiKeyLoaded && menuLoaded && missingBrokerNames.length > 0;

    return (
        <AppTheme themeComponents={xThemeComponents}>
            <CssBaseline enableColorScheme />
            <Box sx={{ display: 'flex' }}>
                <SideMenu />
                <AppNavbar />
                <Box
                    component="main"
                    sx={(theme) => ({
                        flexGrow: 1,
                        backgroundColor: theme.vars
                            ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                            : alpha(theme.palette.background.default, 1),
                        overflow: 'auto',
                    })}
                >
                    <Stack
                        spacing={2}
                        sx={{
                            alignItems: 'center',
                            mx: 3,
                            pb: 5,
                            mt: { xs: 8, md: 0 },
                        }}
                    >
                        <Header />
                        {showApiKeyAlert && (
                            <Alert
                                severity="warning"
                                sx={{ width: '100%', maxWidth: { sm: '100%', md: '900px' }, alignItems: 'center' }}
                                action={
                                    <Button color="inherit" size="small" sx={{ whiteSpace: 'nowrap' }} onClick={() => navigate('/settings/api-keys')}>
                                        등록하기
                                    </Button>
                                }
                            >
                                {missingBrokerNames.join(', ')} API Key가 등록되지 않았습니다. 더 많은 정보를 확인하고 싶다면 API Key를 등록해주세요.
                            </Alert>
                        )}
                        <Outlet />
                    </Stack>
                </Box>
            </Box>
        </AppTheme>
    )
}

export default MainLayout;
