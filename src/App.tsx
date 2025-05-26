import './App.css'
import {Route, Routes} from "react-router-dom";
import Login from "./pages/auth/Login.tsx";
import Dashboard from "./pages/dashboard/Dashboard.tsx";

function App() {

    return (
        <>
            <Routes>
                <Route path="/login" Component={Login} />
                <Route path="/" Component={Dashboard} />
            </Routes>
        </>
    )
}

export default App
