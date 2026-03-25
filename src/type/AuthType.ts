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

export interface TokenRes {
    accessToken: string;
    passwordChangeRequired: boolean;
    role: string;
    nickname: string;
    email: string;
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
    provider: string;
    appKey: string;
    secretKey: string;
}

export interface ApiKeyRes {
    id: number;
    provider: string;
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
    createdAt: string;
}
