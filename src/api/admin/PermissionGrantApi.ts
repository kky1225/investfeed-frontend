import api from '../../axios';
import type {ApiResponse} from '../../type/AuthType';
import type {PermissionRes, UpdateRolePermissionReq} from '../../type/PermissionType';

export const fetchPermissionGrants = async (): Promise<ApiResponse<PermissionRes[]>> => {
    const res = await api.get<ApiResponse<PermissionRes[]>>('/admin/permissions/grants');
    return res.data;
};

export const updateRolePermissions = async (
    id: number,
    req: UpdateRolePermissionReq,
): Promise<ApiResponse<PermissionRes>> => {
    const res = await api.patch<ApiResponse<PermissionRes>>(`/admin/permissions/grants/${id}`, req);
    return res.data;
};
