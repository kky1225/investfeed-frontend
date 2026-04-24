import CssBaseline from "@mui/material/CssBaseline";
import AppTheme from "../components/AppTheme.tsx";
import {dataGridCustomizations} from "../components/customizations/dataGrid.ts";
import {chartsCustomizations} from "../components/customizations/chart.ts";
import { Outlet, useNavigate } from "react-router-dom";
import SideMenu from "../components/SideMenu.tsx";
import AppNavbar from "../components/AppNavbar.tsx";
import Box from "@mui/material/Box";
import {alpha} from "@mui/material/styles";
import Header from "../components/Header.tsx";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import {useEffect, useState} from "react";
import {fetchApiKeys} from "../api/auth/AuthApi.ts";

const xThemeComponents = {
    ...dataGridCustomizations,
    ...chartsCustomizations
};

const MainLayout = () => {
    const navigate = useNavigate();
    const [hasApiKey, setHasApiKey] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetchApiKeys();
                if (!res.result || res.result.length === 0) {
                    setHasApiKey(false);
                }
            } catch (error) {
                console.error(error);
                setHasApiKey(false);
            }
        })();
    }, []);

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
                        {!hasApiKey && (
                            <Alert
                                severity="warning"
                                sx={{ width: '100%', maxWidth: { sm: '100%', md: '900px' }, alignItems: 'center' }}
                                action={
                                    <Button color="inherit" size="small" sx={{ whiteSpace: 'nowrap' }} onClick={() => navigate('/settings/api-keys')}>
                                        등록하기
                                    </Button>
                                }
                            >
                                키움증권 API Key가 등록되지 않았습니다. 더 많은 정보를 확인하고 싶다면 API Key를 등록해주세요.
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
