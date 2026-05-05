export interface RoleRes {
    id: number;
    code: string;
    name: string;
    defaultLandingPath: string | null;
    isSystem: boolean;
    priority: number;
    orderIndex: number;
}

export interface CreateRoleReq {
    code: string;
    name: string;
    defaultLandingPath: string | null;
}

export interface UpdateRoleReq {
    name: string;
    defaultLandingPath: string | null;
}

export interface RoleOrderItem {
    id: number;
    orderIndex: number;
}
