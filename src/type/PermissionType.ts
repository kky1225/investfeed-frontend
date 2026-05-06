export interface ApiPatternRes {
    id: number;
    apiPattern: string;
}

export interface PermissionActionRes {
    action: string;
    description: string | null;
}

export interface RolePermissionRes {
    roleId: number;
    roleCode: string;
    roleName: string;
    /** 이 역할이 해당 권한에 대해 부여받은 action 목록 */
    actions: string[];
}

export interface PermissionRes {
    id: number;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    orderIndex: number;
    apiPatterns: ApiPatternRes[];
    /** 이 권한이 지원하는 action 카탈로그 (READ/CREATE/UPDATE/DELETE + 도메인 액션) */
    supportedActions: PermissionActionRes[];
    rolePermissions: RolePermissionRes[];
}

// ────────────────────────────────────────────────────────────────────────────
// 권한 카탈로그 관리 요청 (개발자용 — /admin/permissions/catalog/**)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatePermissionReq {
    code: string;
    name: string;
    description: string | null;
    apiPatterns: string[];
}

export interface UpdatePermissionReq {
    name: string;
    description: string | null;
}

export interface AddApiPatternReq {
    apiPattern: string;
}

export interface AddPermissionActionReq {
    action: string;
    description: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 권한 부여 요청 (관리자용 — /admin/permissions/grants/**)
// ────────────────────────────────────────────────────────────────────────────

export interface RolePermissionGrant {
    roleCode: string;
    /** 이 역할에 부여할 action 목록 (전체 교체 — 빈 배열은 부여 해제) */
    actions: string[];
}

export interface UpdateRolePermissionReq {
    grants: RolePermissionGrant[];
}

export interface UpdatePermissionMutationVars {
    id: number;
    req: UpdatePermissionReq;
}

export interface AddPatternMutationVars {
    permissionId: number;
    req: AddApiPatternReq;
}

export interface DeletePatternMutationVars {
    permissionId: number;
    patternId: number;
}

export interface AddActionMutationVars {
    permissionId: number;
    req: AddPermissionActionReq;
}

export interface DeleteActionMutationVars {
    permissionId: number;
    action: string;
}

export interface UpdateRolePermissionsMutationVars {
    id: number;
    req: UpdateRolePermissionReq;
}
