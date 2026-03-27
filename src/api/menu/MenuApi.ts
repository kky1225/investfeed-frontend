import api from '../../axios';
import type {ApiResponse} from '../../type/AuthType';
import type {
    MenuRes,
    CreateMenuReq,
    UpdateMenuReq,
    UpdateMenuStructureReq,
    UpdateMenuPermissionReq
} from '../../type/MenuType';

export const fetchAllMenus = async (): Promise<ApiResponse<MenuRes[]>> => {
    const res = await api.get<ApiResponse<MenuRes[]>>('/admin/menus');
    return res.data;
};

export const fetchMyMenus = async (): Promise<ApiResponse<MenuRes[]>> => {
    const res = await api.get<ApiResponse<MenuRes[]>>('/menus/me');
    return res.data;
};

export const createMenu = async (req: CreateMenuReq): Promise<ApiResponse<MenuRes>> => {
    const res = await api.post<ApiResponse<MenuRes>>('/admin/menus', req);
    return res.data;
};

export const updateMenu = async (id: number, req: UpdateMenuReq): Promise<ApiResponse<MenuRes>> => {
    const res = await api.put<ApiResponse<MenuRes>>(`/admin/menus/${id}`, req);
    return res.data;
};

export const deleteMenu = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/admin/menus/${id}`);
    return res.data;
};

export const updateMenuStructure = async (req: UpdateMenuStructureReq): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>('/admin/menus/structure', req);
    return res.data;
};

export const updateMenuPermissions = async (id: number, req: UpdateMenuPermissionReq): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>(`/admin/menus/${id}/permissions`, req);
    return res.data;
};
