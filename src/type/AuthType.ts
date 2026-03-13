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
}

export interface ApiResponse<T> {
    code: string;
    message: string;
    result: T | null;
}

export interface AuthUser {
    loginId: string;
    nickname: string;
    email: string;
}
