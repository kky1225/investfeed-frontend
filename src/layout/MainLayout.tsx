import CssBaseline from "@mui/material/CssBaseline";
import AppTheme from "../components/AppTheme.tsx";
import {dataGridCustomizations} from "../components/customizations/dataGrid.ts";
import {chartsCustomizations} from "../components/customizations/chart.ts";
import { Outlet } from "react-router-dom";
import SideMenu from "../components/SideMenu.tsx";
import AppNavbar from "../components/AppNavbar.tsx";
import Box from "@mui/material/Box";
import {alpha} from "@mui/material/styles";
import Header from "../components/Header.tsx";
import Stack from "@mui/material/Stack";

const xThemeComponents = {
    ...dataGridCustomizations,
    ...chartsCustomizations
};

const MainLayout = () => {
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
                        <Outlet />
                    </Stack>
                </Box>
            </Box>
        </AppTheme>
    )
}

export default MainLayout;