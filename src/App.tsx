import './App.css'
import {useState, useEffect, useCallback} from "react";
import {Route, Routes, useParams, useNavigate} from "react-router-dom";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Login from "./pages/auth/Login.tsx";
import SecondaryAuthDialog from "./components/SecondaryAuthDialog.tsx";
import {useAuth} from "./context/AuthContext.tsx";
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
import Profile from "./pages/settings/Profile.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import ChangePassword from "./pages/settings/ChangePassword.tsx";
import ApiKeyManagement from "./pages/settings/ApiKeyManagement.tsx";
import HoldingList from "./pages/holding/HoldingList.tsx";

const StockDetailWithKey = () => {
    const { id } = useParams();
    return <StockDetail key={id} />;
};

function App() {
    const navigate = useNavigate();
    const {user} = useAuth();
    const [forbidden, setForbidden] = useState<{ open: boolean; message: string }>({
        open: false, message: ''
    });
    const [secondaryAuth, setSecondaryAuth] = useState<{ open: boolean; mode: 'setup' | 'verify' }>({
        open: false, mode: 'verify'
    });

    const handleForbidden = useCallback((e: Event) => {
        const { message } = (e as CustomEvent).detail;
        setForbidden({ open: true, message });
    }, []);

    const handleSecondaryAuth = useCallback((e: Event) => {
        const { code } = (e as CustomEvent).detail;
        const mode = code === 'AUTH_4041' ? 'setup' : 'verify';
        setSecondaryAuth({ open: true, mode });
    }, []);

    useEffect(() => {
        window.addEventListener('show-forbidden', handleForbidden);
        window.addEventListener('show-secondary-auth', handleSecondaryAuth);
        return () => {
            window.removeEventListener('show-forbidden', handleForbidden);
            window.removeEventListener('show-secondary-auth', handleSecondaryAuth);
        };
    }, [handleForbidden, handleSecondaryAuth]);

    const handleForbiddenClose = () => {
        setForbidden({ open: false, message: '' });
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    return (
        <>
            <Dialog open={forbidden.open} onClose={handleForbiddenClose} maxWidth="xs" fullWidth>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 3 }}>
                    <Box sx={{
                        width: 48, height: 48, borderRadius: '50%',
                        bgcolor: 'error.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1
                    }}>
                        <LockOutlinedIcon sx={{ color: 'error.contrastText' }} />
                    </Box>
                </Box>
                <DialogTitle sx={{ textAlign: 'center', pb: 0.5 }}>접근 불가</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ textAlign: 'center' }}>{forbidden.message}</DialogContentText>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 2.5 }}>
                    <Button variant="contained" onClick={handleForbiddenClose} autoFocus>확인</Button>
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

                        <Route path="/stock/holding/list" Component={HoldingList} />
                        <Route path="/stock/investor/:orgnTp/list/:trdeTp" Component={InvestorList} />

                        <Route path="/stock/recommend/list" Component={RecommendList} />

                        <Route path="/crypto/list" Component={CryptoList} />
                        <Route path="/crypto/rank" Component={CryptoRank} />
                        <Route path="/crypto/detail/:id" Component={CryptoDetail} />

                        <Route path="/crypto/interest/list/:groupId?" Component={CryptoInterest} />
                        <Route path="/notification/list" Component={NotificationList} />

                        <Route path="/admin/members" Component={MemberManagement} />
                        <Route path="/admin/menus" Component={MenuManagement} />
                    </Route>
                </Route>
            </Routes>
        </>
    )
}

export default App
