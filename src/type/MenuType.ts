export interface MenuRes {
    id: number;
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
    orderIndex: number;
    visible: boolean;
    permissions: MenuPermissionRes[];
    requiredBrokerIds: number[];
    children: MenuRes[];
}

export interface MenuPermissionRes {
    role: string;
    readable: boolean;
}

export interface CreateMenuReq {
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
    orderIndex: number;
    visible: boolean;
    requiredBrokerIds: number[];
}

export interface UpdateMenuReq {
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
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

export interface MenuPermissionItem {
    role: string;
    readable: boolean;
}

export interface UpdateMenuPermissionReq {
    permissions: MenuPermissionItem[];
}

export interface FlatMenuItem {
    id: number;
    name: string;
    url: string | null;
    icon: string | null;
    parentId: number | null;
    orderIndex: number;
    visible: boolean;
    depth: number;
    permissions: MenuPermissionRes[];
    requiredBrokerIds: number[];
}
