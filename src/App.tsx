import './App.css'
import {useState, useEffect, useCallback} from "react";
import {Route, Routes, useParams, useNavigate} from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {alpha} from "@mui/material/styles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Login from "./pages/auth/Login.tsx";
import SecondaryAuthDialog from "./components/SecondaryAuthDialog.tsx";
import AppTheme from "./components/AppTheme.tsx";
import {processSecondaryAuthQueue} from "./axios.ts";
import Dashboard from "./pages/dashboard/Dashboard.tsx";
import MainLayout from "./layout/MainLayout.tsx";
import Interest from "./pages/interest/Interest.tsx";
import IndexList from "./pages/index/IndexList.tsx";
import IndexDetail from "./pages/index/IndexDetail.tsx";
import StockDetail from "./pages/stock/StockDetail.tsx";
import RankList from "./pages/rank/RankList.tsx";
import CommodityDetail from "./pages/commodity/CommodityDetail.tsx";
import CommodityList from "./pages/commodity/CommodityList.tsx";
import SectList from "./pages/sect/SectList.tsx";
import SectStockList from "./pages/sect/SectStockList.tsx";
import ThemeList from "./pages/theme/ThemeList.tsx";
import ThemeStockList from "./pages/theme/ThemeStockList.tsx";
import InvestorList from "./pages/investor/InvestorList.tsx";
import RecommendList from "./pages/recommend/RecommendList.tsx";
import MarketIndexList from "./pages/marketindex/MarketIndexList.tsx";
import CryptoList from "./pages/crypto/CryptoList.tsx";
import CryptoDetail from "./pages/crypto/CryptoDetail.tsx";
import CryptoRank from "./pages/crypto/CryptoRank.tsx";
import CryptoInterest from "./pages/cryptoInterest/CryptoInterest.tsx";
import NotificationList from "./pages/notification/NotificationList.tsx";
import MemberManagement from "./pages/admin/MemberManagement.tsx";
import MenuManagement from "./pages/admin/MenuManagement.tsx";
import RoleManagement from "./pages/admin/RoleManagement.tsx";
import PermissionCatalogManagement from "./pages/admin/PermissionCatalogManagement.tsx";
import PermissionGrantManagement from "./pages/admin/PermissionGrantManagement.tsx";
import BrokerManagement from "./pages/admin/BrokerManagement.tsx";
import CalendarManagement from "./pages/admin/CalendarManagement.tsx";
import Monitoring from "./pages/admin/Monitoring.tsx";
import Profile from "./pages/settings/Profile.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import ChangePassword from "./pages/settings/ChangePassword.tsx";
import ApiKeyManagement from "./pages/settings/ApiKeyManagement.tsx";
import HoldingPage from "./pages/holding/HoldingPage.tsx";
import CryptoHoldingPage from "./pages/cryptoHolding/CryptoHoldingPage.tsx";
import AssetDashboard from "./pages/assetDashboard/AssetDashboard.tsx";
import MultiViewPage from "./pages/multiView/MultiViewPage.tsx";
import RebalancingPage from "./pages/rebalancing/RebalancingPage.tsx";
import EconomicCalendarPage from "./pages/calendar/EconomicCalendarPage.tsx";
import GoalPage from "./pages/goal/GoalPage.tsx";
import NotificationSettingPage from "./pages/notificationSetting/NotificationSettingPage.tsx";

const StockDetailWithKey = () => {
    const { id } = useParams();
    return <StockDetail key={id} />;
};

function App() {
    const navigate = useNavigate();
    const [forbidden, setForbidden] = useState<{ open: boolean; message: string }>({
        open: false, message: ''
    });
    const [secondaryAuth, setSecondaryAuth] = useState<{ open: boolean; mode: 'setup' | 'verify' }>({
        open: false, mode: 'verify'
    });
    // 일반 에러 Dialog (500/네트워크 등). 이미 열려있으면 새 에러 무시.
    const [globalError, setGlobalError] = useState<string | null>(null);
    // 401 refresh 실패 시 세션 만료 Dialog. 확인 시 /login 으로 강제 이동.
    const [sessionExpired, setSessionExpired] = useState(false);

    const handleForbidden = useCallback((e: Event) => {
        const { message } = (e as CustomEvent).detail;
        setForbidden({ open: true, message });
    }, []);

    const handleSecondaryAuth = useCallback((e: Event) => {
        const { code } = (e as CustomEvent).detail;
        const mode = code === 'AUTH_4041' ? 'setup' : 'verify';
        setSecondaryAuth({ open: true, mode });
    }, []);

    const handleGlobalError = useCallback((e: Event) => {
        // 중복 방지: 이미 다른 에러/세션만료 Dialog 가 열려있으면 무시
        setGlobalError(prev => {
            if (prev !== null) return prev;
            const detail = (e as CustomEvent).detail;
            return detail?.message ?? '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        });
    }, []);

    const handleSessionExpired = useCallback(() => {
        setSessionExpired(prev => prev || true);
    }, []);

    useEffect(() => {
        window.addEventListener('show-forbidden', handleForbidden);
        window.addEventListener('show-secondary-auth', handleSecondaryAuth);
        window.addEventListener('show-global-error', handleGlobalError);
        window.addEventListener('show-session-expired', handleSessionExpired);
        return () => {
            window.removeEventListener('show-forbidden', handleForbidden);
            window.removeEventListener('show-secondary-auth', handleSecondaryAuth);
            window.removeEventListener('show-global-error', handleGlobalError);
            window.removeEventListener('show-session-expired', handleSessionExpired);
        };
    }, [handleForbidden, handleSecondaryAuth, handleGlobalError, handleSessionExpired]);

    const handleForbiddenClose = () => {
        setForbidden({ open: false, message: '' });
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    const handleSessionExpiredConfirm = () => {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('passwordChangeRequired');
        setSessionExpired(false);
        window.location.href = '/login';
    };

    return (
        <AppTheme>
            <Dialog
                open={forbidden.open}
                onClose={handleForbiddenClose}
                maxWidth="xs"
                fullWidth
                slotProps={{ paper: { sx: { borderRadius: 3 } } }}
            >
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pt: 4, pb: 2 }}>
                    <Box sx={{
                        width: 56, height: 56, borderRadius: '50%',
                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2
                    }}>
                        <LockOutlinedIcon sx={{ color: 'error.main', fontSize: 28 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>접근 불가</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {forbidden.message}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
                    <Button fullWidth variant="contained" onClick={handleForbiddenClose} autoFocus>
                        확인
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={!!globalError}
                onClose={() => setGlobalError(null)}
                maxWidth="xs"
                fullWidth
                slotProps={{ paper: { sx: { borderRadius: 3 } } }}
            >
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pt: 4, pb: 2 }}>
                    <Box sx={{
                        width: 56, height: 56, borderRadius: '50%',
                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2
                    }}>
                        <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: 28 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>오류</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {globalError}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
                    <Button fullWidth variant="contained" onClick={() => setGlobalError(null)} autoFocus>
                        확인
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={sessionExpired}
                disableEscapeKeyDown
                maxWidth="xs"
                fullWidth
                slotProps={{ paper: { sx: { borderRadius: 3 } } }}
            >
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', pt: 4, pb: 2 }}>
                    <Box sx={{
                        width: 56, height: 56, borderRadius: '50%',
                        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2
                    }}>
                        <AccessTimeIcon sx={{ color: 'warning.main', fontSize: 28 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>세션 만료</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        세션이 만료되었습니다. 다시 로그인해주세요.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
                    <Button fullWidth variant="contained" onClick={handleSessionExpiredConfirm} autoFocus>
                        확인
                    </Button>
                </DialogActions>
            </Dialog>
            <SecondaryAuthDialog
                open={secondaryAuth.open}
                mode={secondaryAuth.mode}
                onSuccess={() => {
                    setSecondaryAuth({open: false, mode: 'verify'});
                    processSecondaryAuthQueue(null);
                }}
                onClose={() => {
                    setSecondaryAuth({open: false, mode: 'verify'});
                    processSecondaryAuthQueue(new Error('cancelled'));
                    if (window.history.length > 1) {
                        navigate(-1);
                    } else {
                        navigate('/');
                    }
                }}
            />
            <Routes>
                <Route path="/login" Component={Login} />

                <Route element={<ProtectedRoute />}>
                    <Route path="/settings/change-password" Component={ChangePassword} />
                    <Route path="/settings/profile" Component={Profile} />
                    <Route path="/settings/api-keys" Component={ApiKeyManagement} />
                    <Route element={<MainLayout />}>
                        <Route path="/" Component={MarketIndexList} />
                        <Route path="/stock/dashboard" Component={Dashboard} />
                        <Route path="/dashboard" Component={AssetDashboard} />
                        <Route path="/stock/interest" Component={Interest} />
                        <Route path="/stock/interest/list/:groupId?" Component={Interest} />
                        <Route path="/stock/index/list" Component={IndexList} />
                        <Route path="/stock/index/detail/:id" Component={IndexDetail} />
                        <Route path="/commodity/list" Component={CommodityList} />
                        <Route path="/commodity/detail/:id" Component={CommodityDetail} />

                        <Route path="/stock/rank/list/:type" Component={RankList} />
                        <Route path="/stock/detail/:id" Component={StockDetailWithKey} />

                        <Route path="/stock/sect/list/:indsCd" Component={SectList} />
                        <Route path="/stock/sect/:indsCd/list" Component={SectStockList} />

                        <Route path="/stock/theme/list" Component={ThemeList} />
                        <Route path="/stock/theme/:themaGrpCd/list" Component={ThemeStockList} />

                        <Route path="/stock/holding/list/:brokerId?" Component={HoldingPage} />
                        <Route path="/crypto/holding/list/:brokerId?" Component={CryptoHoldingPage} />
                        <Route path="/stock/investor/:orgnTp/list/:trdeTp" Component={InvestorList} />

                        <Route path="/stock/recommend/list" Component={RecommendList} />

                        <Route path="/crypto/list" Component={CryptoList} />
                        <Route path="/crypto/rank" Component={CryptoRank} />
                        <Route path="/crypto/detail/:id" Component={CryptoDetail} />

                        <Route path="/crypto/interest/list/:groupId?" Component={CryptoInterest} />
                        <Route path="/multi-view" Component={MultiViewPage} />
                        <Route path="/rebalancing" Component={RebalancingPage} />
                        <Route path="/calendar" Component={EconomicCalendarPage} />
                        <Route path="/goal" Component={GoalPage} />
                        <Route path="/notification/list" Component={NotificationList} />
                        <Route path="/notification/settings" Component={NotificationSettingPage} />

                        <Route path="/admin/roles" Component={RoleManagement} />
                        <Route path="/admin/permissions/catalog" Component={PermissionCatalogManagement} />
                        <Route path="/admin/permissions/grants" Component={PermissionGrantManagement} />
                        <Route path="/admin/members" Component={MemberManagement} />
                        <Route path="/admin/menus" Component={MenuManagement} />
                        <Route path="/admin/brokers" Component={BrokerManagement} />
                        <Route path="/admin/calendar" Component={CalendarManagement} />
                        <Route path="/admin/monitoring" Component={Monitoring} />
                    </Route>
                </Route>
            </Routes>
        </AppTheme>
    )
}

export default App
