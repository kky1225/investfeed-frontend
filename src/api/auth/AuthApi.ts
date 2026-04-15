import api from '../../axios';
import type { LoginReq, ChangePasswordReq, UpdateProfileReq, ApiKeyReq, ApiKeyRes, TokenRes, PreAuthRes, TotpSetupRes, TotpVerifyReq, SecondaryPasswordSetupReq, SecondaryPasswordVerifyReq, SecondaryPasswordChangeReq, MemberRes, ApiResponse } from '../../type/AuthType';

export const login = async (req: LoginReq): Promise<ApiResponse<PreAuthRes>> => {
    const res = await api.post<ApiResponse<PreAuthRes>>('/auth/login', req);
    return res.data;
};

export const totpSetup = async (): Promise<ApiResponse<TotpSetupRes>> => {
    const res = await api.post<ApiResponse<TotpSetupRes>>('/auth/totp/setup');
    return res.data;
};

export const totpVerify = async (req: TotpVerifyReq): Promise<ApiResponse<TokenRes>> => {
    const res = await api.post<ApiResponse<TokenRes>>('/auth/totp/verify', req);
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

export const fetchApiKeys = async (): Promise<ApiResponse<ApiKeyRes[]>> => {
    const res = await api.get<ApiResponse<ApiKeyRes[]>>('/auth/api-keys');
    return res.data;
};

export const createApiKey = async (req: ApiKeyReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>('/auth/api-keys', req);
    return res.data;
};

export const deleteApiKey = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/auth/api-keys/${id}`);
    return res.data;
};

export const setupSecondaryPassword = async (req: SecondaryPasswordSetupReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>('/auth/secondary-password/setup', req);
    return res.data;
};

export const verifySecondaryPassword = async (req: SecondaryPasswordVerifyReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>('/auth/secondary-password/verify', req);
    return res.data;
};

export const changeSecondaryPassword = async (req: SecondaryPasswordChangeReq): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>('/auth/secondary-password/change', req);
    return res.data;
};

export const fetchSecondaryPasswordLockStatus = async (): Promise<ApiResponse<{ remainingSeconds: number }>> => {
    const res = await api.get<ApiResponse<{ remainingSeconds: number }>>('/auth/secondary-password/lock-status');
    return res.data;
};
