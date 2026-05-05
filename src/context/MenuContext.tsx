import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {fetchMyMenus} from '../api/menu/MenuApi';
import type {MenuRes} from '../type/MenuType';
import {useAuth} from './AuthContext';

interface MenuContextType {
    menuTree: MenuRes[];
    menuLoaded: boolean;
    reloadMenus: () => Promise<void>;
}

const MenuContext = createContext<MenuContextType>({
    menuTree: [],
    menuLoaded: false,
    reloadMenus: async () => {},
});

export function MenuProvider({children}: {children: ReactNode}) {
    const [menuTree, setMenuTree] = useState<MenuRes[]>([]);
    const [menuLoaded, setMenuLoaded] = useState(false);
    const {isAuthenticated, isInitialized} = useAuth();

    const reloadMenus = useCallback(async () => {
        try {
            const res = await fetchMyMenus();
            if (res.code !== "0000") throw new Error(res.message || `메뉴 조회 실패 (${res.code})`);
            if (res.result) setMenuTree(res.result);
        } catch (error) {
            console.error(error);
        } finally {
            setMenuLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isInitialized) return;
        if (!isAuthenticated) {
            setMenuTree([]);
            setMenuLoaded(true);
            return;
        }
        reloadMenus();
    }, [isInitialized, isAuthenticated, reloadMenus]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const handler = () => { reloadMenus(); };
        window.addEventListener('menu-updated', handler);
        return () => window.removeEventListener('menu-updated', handler);
    }, [isAuthenticated, reloadMenus]);

    return (
        <MenuContext.Provider value={{menuTree, menuLoaded, reloadMenus}}>
            {children}
        </MenuContext.Provider>
    );
}

export const useMenuTree = () => useContext(MenuContext);
