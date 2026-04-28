import api from '../../axios';
import type { ApiResponse, CreateMemberReq, MemberRes } from '../../type/AuthType';

export const createMember = async (req: CreateMemberReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>('/auth/admin/members', req);
    return res.data;
};

export const fetchMembers = async (): Promise<ApiResponse<MemberRes[]>> => {
    const res = await api.get<ApiResponse<MemberRes[]>>('/auth/admin/members');
    return res.data;
};

export const lockAccount = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/auth/admin/members/${loginId}/lock`);
    return res.data;
};

export const unlockAccount = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/auth/admin/members/${loginId}/unlock`);
    return res.data;
};

export const changeRole = async (loginId: string, role: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/auth/admin/members/${loginId}/role`, {role});
    return res.data;
};

export const resetTotp = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/auth/admin/members/${loginId}/totp-reset`);
    return res.data;
};

export const unlockApiKey = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/auth/admin/members/${loginId}/api-key-unlock`);
    return res.data;
};
