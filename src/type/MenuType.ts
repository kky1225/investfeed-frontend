export interface MenuRes {
    id: number;
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
    requiredPermissionId: number | null;
    requiredPermissionCode: string | null;
    requiredPermissionName: string | null;
    orderIndex: number;
    visible: boolean;
    requiredBrokerIds: number[];
    children: MenuRes[];
}

export interface CreateMenuReq {
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
    requiredPermissionId: number | null;
    orderIndex: number;
    visible: boolean;
    requiredBrokerIds: number[];
}

export interface UpdateMenuReq {
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
    requiredPermissionId: number | null;
    visible: boolean;
}

export interface UpdateMenuBrokersReq {
    brokerIds: number[];
}

export interface MenuStructureItem {
    id: number;
    parentId: number | null;
    orderIndex: number;
}

export interface UpdateMenuStructureReq {
    structures: MenuStructureItem[];
}

export interface FlatMenuItem {
    id: number;
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
    requiredPermissionId: number | null;
    requiredPermissionCode: string | null;
    requiredPermissionName: string | null;
    orderIndex: number;
    visible: boolean;
    depth: number;
    requiredBrokerIds: number[];
}

export interface UpdateMenuMutationVars {
    id: number;
    req: UpdateMenuReq;
}

export interface UpdateMenuBrokersMutationVars {
    menuId: number;
    req: UpdateMenuBrokersReq;
}
