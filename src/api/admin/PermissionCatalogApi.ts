import type {AxiosRequestConfig} from 'axios';
import api from '../../axios';
import type {ApiResponse} from '../../type/AuthType';
import type {
    AddApiPatternReq,
    AddPermissionActionReq,
    CreatePermissionReq,
    PermissionRes,
    UpdatePermissionReq,
} from '../../type/PermissionType';

export const fetchPermissionCatalog = async (config?: AxiosRequestConfig): Promise<ApiResponse<PermissionRes[]>> => {
    const res = await api.get<ApiResponse<PermissionRes[]>>('/admin/permissions/catalog', config);
    return res.data;
};

export const createPermission = async (req: CreatePermissionReq): Promise<ApiResponse<PermissionRes>> => {
    const res = await api.post<ApiResponse<PermissionRes>>('/admin/permissions/catalog', req);
    return res.data;
};

export const updatePermission = async (id: number, req: UpdatePermissionReq): Promise<ApiResponse<PermissionRes>> => {
    const res = await api.put<ApiResponse<PermissionRes>>(`/admin/permissions/catalog/${id}`, req);
    return res.data;
};

export const deletePermission = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/admin/permissions/catalog/${id}`);
    return res.data;
};

export const addApiPattern = async (id: number, req: AddApiPatternReq): Promise<ApiResponse<PermissionRes>> => {
    const res = await api.post<ApiResponse<PermissionRes>>(`/admin/permissions/catalog/${id}/patterns`, req);
    return res.data;
};

export const deleteApiPattern = async (id: number, patternId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/admin/permissions/catalog/${id}/patterns/${patternId}`);
    return res.data;
};

export const addPermissionAction = async (
    id: number,
    req: AddPermissionActionReq,
): Promise<ApiResponse<PermissionRes>> => {
    const res = await api.post<ApiResponse<PermissionRes>>(`/admin/permissions/catalog/${id}/actions`, req);
    return res.data;
};

export const deletePermissionAction = async (id: number, action: string): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/admin/permissions/catalog/${id}/actions/${action}`);
    return res.data;
};
