import api from '../../axios';
import type { ApiResponse, MemberRes } from '../../type/AuthType';

export const fetchMembers = async (): Promise<ApiResponse<MemberRes[]>> => {
    const res = await api.get<ApiResponse<MemberRes[]>>('/auth/admin/members');
    return res.data;
};

export const lockAccount = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>(`/auth/admin/members/${loginId}/lock`);
    return res.data;
};

export const unlockAccount = async (loginId: string): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>(`/auth/admin/members/${loginId}/unlock`);
    return res.data;
};
