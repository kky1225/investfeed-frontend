import type {AxiosRequestConfig} from 'axios';
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
    const res = await api.patch<ApiResponse<null>>('/auth/password', req);
    return res.data;
};

export const fetchProfile = async (config?: AxiosRequestConfig): Promise<ApiResponse<MemberRes>> => {
    const res = await api.get<ApiResponse<MemberRes>>('/auth/profile', config);
    return res.data;
};

export const updateProfile = async (req: UpdateProfileReq): Promise<ApiResponse<null>> => {
    const res = await api.put<ApiResponse<null>>('/auth/profile', req);
    return res.data;
};

export const fetchApiKeys = async (config?: AxiosRequestConfig): Promise<ApiResponse<ApiKeyRes[]>> => {
    const res = await api.get<ApiResponse<ApiKeyRes[]>>('/auth/api-keys', config);
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
    const res = await api.patch<ApiResponse<null>>('/auth/secondary-password/change', req);
    return res.data;
};

/**
 * 2차 비밀번호 상태.
 * suspended: 여러 번 틀려 정지됐는지(관리자가 초기화해야 풀림). remainingAttempts: 이만큼 더 틀리면 정지된다.
 * authRemainingSeconds: 2차 인증이 유지되는 남은 초(인증 전이면 0)
 */
export interface SecondaryPasswordLockStatus {
    suspended?: boolean;
    remainingAttempts?: number;
    authRemainingSeconds?: number;
    passwordSet?: boolean;      // 2차 비밀번호를 만들어 두었는지
}

export const fetchSecondaryPasswordLockStatus = async (config?: AxiosRequestConfig): Promise<ApiResponse<SecondaryPasswordLockStatus>> => {
    const res = await api.get<ApiResponse<SecondaryPasswordLockStatus>>('/auth/secondary-password/lock-status', config);
    return res.data;
};

/** 2차 인증을 지금 끝낸다 (상단 자물쇠의 "지금 잠그기") */
export const endSecondaryAuth = async (): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>('/auth/secondary-password/session');
    return res.data;
};
