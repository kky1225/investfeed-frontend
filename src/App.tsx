import './App.css'
import {Route, Routes} from "react-router-dom";
import Login from "./pages/auth/Login.tsx";
import Dashboard from "./pages/dashboard/Dashboard.tsx";
import MainLayout from "./layout/MainLayout.tsx";
import Interest from "./pages/interest/Interest.tsx";
import IndexList from "./pages/index/IndexList.tsx";
import IndexDetail from "./pages/index/IndexDetail.tsx";
import StockDetail from "./pages/stock/StockDetail.tsx";
import StockList from "./pages/stock/StockList.tsx";

function App() {

    return (
        <>
            <Routes>
                <Route path="/login" Component={Login} />

                <Route element={<MainLayout />} >
                    <Route path="/" Component={Dashboard} />
                    <Route path="/interest" Component={Interest} />
                    <Route path="/index" Component={IndexList} />
                    <Route path="/index/:id" Component={IndexDetail} />

                    <Route path="/stock" Component={StockList} />
                    <Route path="/stock/:id" Component={StockDetail} />
                </Route>
            </Routes>
        </>
    )
}

export default App
