import './App.css'
import {Route, Routes} from "react-router-dom";
import Login from "./pages/auth/Login.tsx";
import Dashboard from "./pages/dashboard/Dashboard.tsx";
import MainLayout from "./layout/MainLayout.tsx";
import Interest from "./pages/interest/Interest.tsx";

function App() {

    return (
        <>
            <Routes>
                <Route path="/login" Component={Login} />

                <Route element={<MainLayout />} >
                    <Route path="/" Component={Dashboard} />
                    <Route path="/interest" Component={Interest} />
                </Route>
            </Routes>
        </>
    )
}

export default App
