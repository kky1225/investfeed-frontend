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
}
