export interface LoginReq {
    loginId: string;
    password: string;
}

export interface PreAuthRes {
    totpRequired: boolean;
    totpSetupRequired: boolean;
}

export interface TotpSetupRes {
    qrCodeImage: string;
}

export interface TotpVerifyReq {
    code: string;
}

export interface UserPermission {
    code: string;
    actions: string[];
}

export interface TokenRes {
    passwordChangeRequired: boolean;
    role: string;
    nickname: string;
    email: string;
    secondaryPasswordEnabled: boolean;
    defaultPath?: string;
    permissions: UserPermission[];
}

export interface ApiResponse<T> {
    code: string;
    message: string;
    result: T | null;
}

export interface ChangePasswordReq {
    currentPassword: string;
    newPassword: string;
}

export interface AuthUser {
    loginId: string;
    nickname: string;
    email: string;
    role: string;
    secondaryPasswordEnabled: boolean;
    permissions: UserPermission[];
}

export interface SecondaryPasswordSetupReq {
    password: string;
}

export interface SecondaryPasswordVerifyReq {
    password: string;
}

export interface SecondaryPasswordChangeReq {
    currentPassword: string;
    newPassword: string;
}

export interface UpdateProfileReq {
    nickname: string;
    email: string;
    name: string;
    phone: string;
}

export interface CreateMemberReq {
    loginId: string;
    email: string;
    nickname: string;
    name: string;
    phone: string;
    role: string;
}

export interface ApiKeyReq {
    brokerId: number;
    appKey: string;
    secretKey: string;
    expiresAt: string;
}

export interface ApiKeyRes {
    id: number;
    brokerId: number;
    brokerName: string;
    appKey: string;
    expiresAt: string;
    createdAt: string;
}

export interface MemberRes {
    id: number;
    loginId: string;
    email: string;
    nickname: string;
    name: string;
    phone: string;
    role: string;
    failedLoginAttempts: number;
    failedTotpAttempts: number;
    lockedAt: string | null;
    lockExpiresAt: string | null;
    permanentLock: boolean;
    totpEnabled: boolean;
    secondaryPasswordEnabled: boolean;
    failedSecondaryAttempts?: number;       // 2차 비밀번호를 연달아 틀린 횟수
    secondaryPasswordSuspended?: boolean;   // 여러 번 틀려 2차 비밀번호가 정지됐는지 (관리자가 초기화해야 풀림)
    apiKeyLocked: boolean;
    createdAt: string;
    permissions: UserPermission[];
}
