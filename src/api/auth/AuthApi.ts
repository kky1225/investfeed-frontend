import api from '../../axios';
import type { LoginReq, SignupReq, ChangePasswordReq, UpdateProfileReq, TokenRes, MemberRes, ApiResponse } from '../../type/AuthType';

export const login = async (req: LoginReq): Promise<ApiResponse<TokenRes>> => {
    const res = await api.post<ApiResponse<TokenRes>>('/auth/login', req);
    return res.data;
};

export const signup = async (req: SignupReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>('/auth/signup', req);
    return res.data;
};

export const fetchReissue = async (): Promise<ApiResponse<TokenRes>> => {
    const res = await api.post<ApiResponse<TokenRes>>('/auth/reissue');
    return res.data;
};

export const logout = async (): Promise<void> => {
    await api.post('/auth/logout');
};

export const changePassword = async (req: ChangePasswordReq): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>('/auth/password', req);
    return res.data;
};

export const fetchProfile = async (): Promise<ApiResponse<MemberRes>> => {
    const res = await api.get<ApiResponse<MemberRes>>('/auth/profile');
    return res.data;
};

export const updateProfile = async (req: UpdateProfileReq): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>('/auth/profile', req);
    return res.data;
};
