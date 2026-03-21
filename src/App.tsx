import './App.css'
import {Route, Routes, useParams} from "react-router-dom";
import Login from "./pages/auth/Login.tsx";
import Signup from "./pages/auth/Signup.tsx";
import Dashboard from "./pages/dashboard/Dashboard.tsx";
import MainLayout from "./layout/MainLayout.tsx";
import Interest from "./pages/interest/Interest.tsx";
import IndexList from "./pages/index/IndexList.tsx";
import IndexDetail from "./pages/index/IndexDetail.tsx";
import StockDetail from "./pages/stock/StockDetail.tsx";
import StockList from "./pages/stock/StockList.tsx";
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
import CryptoInterest from "./pages/cryptoInterest/CryptoInterest.tsx";
import NotificationList from "./pages/notification/NotificationList.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";

const StockDetailWithKey = () => {
    const { id } = useParams();
    return <StockDetail key={id} />;
};

function App() {
    return (
        <>
            <Routes>
                <Route path="/login" Component={Login} />
                <Route path="/signup" Component={Signup} />

                <Route element={<ProtectedRoute />}>
                    <Route element={<MainLayout />}>
                        <Route path="/" Component={Dashboard} />
                        <Route path="/interest" Component={Interest} />
                        <Route path="/index/list" Component={IndexList} />
                        <Route path="/index/detail/:id" Component={IndexDetail} />
                        <Route path="/commodity/list" Component={CommodityList} />
                        <Route path="/commodity/detail/:id" Component={CommodityDetail} />

                        <Route path="/stock/list/:type" Component={StockList} />
                        <Route path="/stock/detail/:id" Component={StockDetailWithKey} />

                        <Route path="/sect/list/:indsCd" Component={SectList} />
                        <Route path="/sect/:indsCd/list" Component={SectStockList} />

                        <Route path="/theme/list" Component={ThemeList} />
                        <Route path="/theme/:themaGrpCd/list" Component={ThemeStockList} />

                        <Route path="/investor/:orgnTp/list/:trdeTp" Component={InvestorList} />

                        <Route path="/recommend/list" Component={RecommendList} />

                        <Route path="/market-index/list" Component={MarketIndexList} />

                        <Route path="/crypto/list" Component={CryptoList} />
                        <Route path="/crypto/detail/:id" Component={CryptoDetail} />

                        <Route path="/crypto-interest/list/:groupId?" Component={CryptoInterest} />
                        <Route path="/interest/list/:groupId?" Component={Interest} />

                        <Route path="/notification/list" Component={NotificationList} />
                    </Route>
                </Route>
            </Routes>
        </>
    )
}

export default App
