export interface LoginReq {
    loginId: string;
    password: string;
}

export interface SignupReq {
    loginId: string;
    password: string;
    email: string;
    nickname: string;
    name: string;
    phone: string;
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

export interface TokenRes {
    passwordChangeRequired: boolean;
    role: string;
    nickname: string;
    email: string;
    secondaryPasswordEnabled: boolean;
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
}

export interface ApiKeyRes {
    id: number;
    brokerId: number;
    brokerName: string;
    appKey: string;
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
    lockedAt: string | null;
    lockExpiresAt: string | null;
    permanentLock: boolean;
    totpEnabled: boolean;
    secondaryPasswordEnabled: boolean;
    createdAt: string;
}
