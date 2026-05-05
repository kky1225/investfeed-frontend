// 역할별 Chip 색상 매핑 — 회원 관리 / 권한 부여 등 모든 역할 표시 화면에서 일관 사용.
// SUPER_ADMIN: 빨강 (최고 권한 강조), ADMIN: 금색, USER: 파랑, GUEST: 회색
export type RoleChipColor = 'error' | 'warning' | 'primary' | 'default';

export function getRoleChipColor(role: string): RoleChipColor {
    return role === 'SUPER_ADMIN' ? 'error'
        : role === 'ADMIN' ? 'warning'
        : role === 'USER' ? 'primary'
        : 'default';
}
