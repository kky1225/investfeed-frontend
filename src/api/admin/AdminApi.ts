import api from '../../axios';
import type { ApiResponse, CreateMemberReq, MemberRes } from '../../type/AuthType';
import type { CreateRoleReq, RoleOrderItem, RoleRes, UpdateRoleReq } from '../../type/RoleType';

export const createMember = async (req: CreateMemberReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>('/admin/members', req);
    return res.data;
};

export const fetchMembers = async (): Promise<ApiResponse<MemberRes[]>> => {
    const res = await api.get<ApiResponse<MemberRes[]>>('/admin/members');
    return res.data;
};

export const lockAccount = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/admin/members/${loginId}/lock`);
    return res.data;
};

export const unlockAccount = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/admin/members/${loginId}/unlock`);
    return res.data;
};

export const changeRole = async (loginId: string, role: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/admin/members/${loginId}/role`, {role});
    return res.data;
};

export const resetTotp = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/admin/members/${loginId}/totp-reset`);
    return res.data;
};

export const unlockApiKey = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/admin/members/${loginId}/api-key-unlock`);
    return res.data;
};

export const fetchRoles = async (): Promise<ApiResponse<RoleRes[]>> => {
    const res = await api.get<ApiResponse<RoleRes[]>>('/admin/roles');
    return res.data;
};

export const createRole = async (req: CreateRoleReq): Promise<ApiResponse<RoleRes>> => {
    const res = await api.post<ApiResponse<RoleRes>>('/admin/roles', req);
    return res.data;
};

export const updateRole = async (id: number, req: UpdateRoleReq): Promise<ApiResponse<RoleRes>> => {
    const res = await api.put<ApiResponse<RoleRes>>(`/admin/roles/${id}`, req);
    return res.data;
};

export const deleteRole = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/admin/roles/${id}`);
    return res.data;
};

export const updateRoleOrder = async (orders: RoleOrderItem[]): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>('/admin/roles/order', {orders});
    return res.data;
};
