import {useMemo, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {requireOk} from '../../lib/apiResponse';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import SaveIcon from '@mui/icons-material/Save';
import {fetchPermissionGrants, updateRolePermissions} from '../../api/admin/PermissionGrantApi';
import {fetchRoles} from '../../api/admin/AdminApi';
import type {PermissionRes, RolePermissionGrant, UpdateRolePermissionReq} from '../../type/PermissionType';
import type {RoleRes} from '../../type/RoleType';
import {useAuth} from '../../context/AuthContext';
import {useAlert} from '../../context/AlertContext';
import {getRoleChipColor} from '../../utils/roleColor';

/**
 * MatrixState[roleCode] = 부여된 action set (Set<string>)
 * 권한별 supportedActions 가 다르므로 동적으로 체크박스 노출.
 */
type MatrixState = Record<string, Set<string>>;

interface UpdateRolePermissionsMutationVars {
    id: number;
    req: UpdateRolePermissionReq;
}

export default function PermissionGrantManagement() {
    const {user} = useAuth();
    const showAlert = useAlert();
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const {data: permissionsData, isLoading: loading, isError: permError} = useQuery<PermissionRes[]>({
        queryKey: ['admin', 'permissionGrants'],
        queryFn: async ({signal}) => requireOk(await fetchPermissionGrants({signal, skipGlobalError: true}), [] as PermissionRes[]),
    });
    const permissions = permissionsData ?? [];

    const {data: rolesData} = useQuery<RoleRes[]>({
        queryKey: ['admin', 'roles'],
        queryFn: async ({signal}) => requireOk(await fetchRoles({signal, skipGlobalError: true}), [] as RoleRes[]),
    });
    const roles = rolesData ?? [];

    // 에러 알림
    const [prevPermError, setPrevPermError] = useState(false);
    if (permError !== prevPermError) {
        setPrevPermError(permError);
        if (permError) showAlert('권한 목록을 불러오는데 실패했습니다.', 'error');
    }

    // permissions 로드 후 selectedId 자동 선택 — permissionsData 직접 비교 (?? [] 새 배열 트랩 회피)
    const [prevPermissionsData, setPrevPermissionsData] = useState(permissionsData);
    if (permissionsData !== prevPermissionsData) {
        setPrevPermissionsData(permissionsData);
        if (permissions.length > 0) {
            if (selectedId === null || !permissions.some(p => p.id === selectedId)) {
                setSelectedId(permissions[0].id);
            }
        } else {
            setSelectedId(null);
        }
    }

    // 본인 priority — roles 로드 후 본인 role.code 매칭으로 추출
    const currentUserPriority = useMemo(() => {
        if (!user || roles.length === 0) return Number.MAX_SAFE_INTEGER;
        return roles.find(r => r.code === user.role)?.priority ?? Number.MAX_SAFE_INTEGER;
    }, [user, roles]);

    const [matrix, setMatrix] = useState<MatrixState>({});
    const [matrixDirty, setMatrixDirty] = useState(false);

    const loadPermissions = async () => {
        await queryClient.invalidateQueries({queryKey: ['admin', 'permissionGrants']});
    };

    const selected = useMemo(
        () => permissions.find(p => p.id === selectedId) ?? null,
        [permissions, selectedId],
    );

    // 선택 권한 / roles 변경 시 매트릭스 초기화 — selected + rolesData 비교 (?? [] 트랩 회피)
    const [prevSelected, setPrevSelected] = useState(selected);
    const [prevRolesData, setPrevRolesData] = useState(rolesData);
    if (selected !== prevSelected || rolesData !== prevRolesData) {
        setPrevSelected(selected);
        setPrevRolesData(rolesData);
        if (!selected || roles.length === 0) {
            setMatrix({});
            setMatrixDirty(false);
        } else {
            const next: MatrixState = {};
            roles.forEach(role => {
                const grant = selected.rolePermissions.find(rp => rp.roleCode === role.code);
                next[role.code] = new Set(grant?.actions ?? []);
            });
            setMatrix(next);
            setMatrixDirty(false);
        }
    }

    const toggleAction = (roleCode: string, action: string) => {
        setMatrix(prev => {
            const set = new Set(prev[roleCode] ?? []);
            if (set.has(action)) set.delete(action);
            else set.add(action);
            return {...prev, [roleCode]: set};
        });
        setMatrixDirty(true);
    };

    const toggleAllForRole = (roleCode: string) => {
        if (!selected) return;
        const allActions = selected.supportedActions.map(a => a.action);
        setMatrix(prev => {
            const cur = prev[roleCode] ?? new Set();
            const allOn = allActions.every(a => cur.has(a));
            return {...prev, [roleCode]: allOn ? new Set() : new Set(allActions)};
        });
        setMatrixDirty(true);
    };

    const updatePermissionsMutation = useMutation({
        mutationFn: async (vars: UpdateRolePermissionsMutationVars) => {
            requireOk(await updateRolePermissions(vars.id, vars.req), '역할별 권한 변경');
        },
        onSuccess: () => {
            showAlert('역할별 권한이 저장되었습니다.', 'success');
            setMatrixDirty(false);
            loadPermissions();
        },
        onError: (err) => {
            console.error(err);
            const axiosErr = err as {response?: {data?: {message?: string}}};
            showAlert(axiosErr.response?.data?.message || '저장에 실패했습니다.', 'error');
        },
    });

    const handleSave = () => {
        if (!selected) return;
        // hierarchy: 본인보다 동등/상위 role 은 grants 에 포함 X (백엔드 검증과 일치)
        const blockedCodes = new Set(
            roles.filter(r => r.priority <= currentUserPriority).map(r => r.code)
        );
        const grants: RolePermissionGrant[] = Object.entries(matrix)
            .filter(([roleCode]) => !blockedCodes.has(roleCode))
            .map(([roleCode, actions]) => ({
                roleCode,
                actions: Array.from(actions),
            }));
        const vars: UpdateRolePermissionsMutationVars = {id: selected.id, req: {grants}};
        updatePermissionsMutation.mutate(vars);
    };

    const systemPermissions = permissions.filter(p => p.isSystem);
    const customPermissions = permissions.filter(p => !p.isSystem);

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h5">권한 부여</Typography>
            </Box>

            <Alert severity="info" sx={{mb: 2}}>
                권한별로 역할에 어떤 action 을 부여할지 설정합니다. 권한 자체의 추가/수정/api 패턴 관리는 권한 카탈로그 화면(SUPER_ADMIN 전용)에서 진행하세요.
            </Alert>

            {loading ? (
                <Stack spacing={1}>
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} height={64} variant="rectangular" />)}
                </Stack>
            ) : (
                <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', md: '320px 1fr'}, gap: 2}}>
                    {/* 좌측: 권한 목록 */}
                    <Paper sx={{p: 1, maxHeight: '75vh', overflow: 'auto'}}>
                        <Typography variant="overline" sx={{px: 1, color: 'text.secondary'}}>
                            시스템 ({systemPermissions.length})
                        </Typography>
                        <List dense disablePadding>
                            {systemPermissions.map(p => (
                                <ListItemButton
                                    key={p.id}
                                    selected={selectedId === p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    sx={{borderRadius: 1, mb: 0.25}}
                                >
                                    <Box sx={{flex: 1, minWidth: 0}}>
                                        <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>{p.code}</Typography>
                                    </Box>
                                </ListItemButton>
                            ))}
                        </List>
                        {customPermissions.length > 0 && (
                            <>
                                <Divider sx={{my: 1}} />
                                <Typography variant="overline" sx={{px: 1, color: 'text.secondary'}}>
                                    사용자 정의 ({customPermissions.length})
                                </Typography>
                                <List dense disablePadding>
                                    {customPermissions.map(p => (
                                        <ListItemButton
                                            key={p.id}
                                            selected={selectedId === p.id}
                                            onClick={() => setSelectedId(p.id)}
                                            sx={{borderRadius: 1, mb: 0.25}}
                                        >
                                            <Box sx={{flex: 1, minWidth: 0}}>
                                                <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>{p.code}</Typography>
                                            </Box>
                                        </ListItemButton>
                                    ))}
                                </List>
                            </>
                        )}
                    </Paper>

                    {/* 우측: 선택 권한 — read-only 정보 + 매트릭스 */}
                    {!selected ? (
                        <Paper sx={{p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            <Typography variant="body2" color="text.secondary">권한을 선택하세요.</Typography>
                        </Paper>
                    ) : (
                        <Paper sx={{p: 2}}>
                            <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap'}}>
                                <Typography variant="h6">{selected.name}</Typography>
                                <Chip label={selected.code} size="small" variant="outlined" />
                                {selected.isSystem && <Chip label="시스템" size="small" color="warning" />}
                            </Box>
                            {selected.description && (
                                <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
                                    {selected.description}
                                </Typography>
                            )}

                            <Divider sx={{my: 2}} />

                            {/* read-only API 패턴 */}
                            <Box sx={{mb: 2}}>
                                <Typography variant="subtitle2" sx={{mb: 1}}>API 패턴</Typography>
                                {selected.apiPatterns.length === 0 ? (
                                    <Alert severity="warning" sx={{py: 0.5}}>
                                        등록된 API 패턴이 없습니다. (카탈로그 화면에서 등록 필요)
                                    </Alert>
                                ) : (
                                    <Stack spacing={0.5}>
                                        {selected.apiPatterns.map(ap => (
                                            <Box
                                                key={ap.id}
                                                sx={{px: 1, py: 0.5, borderRadius: 1, bgcolor: 'action.hover'}}
                                            >
                                                <Typography variant="body2" sx={{fontFamily: 'monospace'}}>
                                                    {ap.apiPattern}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Box>

                            <Divider sx={{my: 2}} />

                            {/* 매트릭스 영역 (편집 가능) */}
                            <Box>
                                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
                                    <Typography variant="subtitle2">역할별 action 부여</Typography>
                                    {matrixDirty && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="warning"
                                            startIcon={<SaveIcon />}
                                            disabled={updatePermissionsMutation.isPending}
                                            onClick={handleSave}
                                        >
                                            {updatePermissionsMutation.isPending ? '저장 중...' : '저장'}
                                        </Button>
                                    )}
                                </Box>

                                {selected.supportedActions.length === 0 ? (
                                    <Alert severity="warning">
                                        지원 action 이 등록되지 않았습니다. (카탈로그 화면에서 추가)
                                    </Alert>
                                ) : (
                                    <>
                                        <Stack spacing={1}>
                                            {roles.map(role => {
                                                const cur = matrix[role.code] ?? new Set();
                                                const allActions = selected.supportedActions.map(a => a.action);
                                                const allOn = allActions.every(a => cur.has(a));
                                                // hierarchy: 본인 priority 와 동등하거나 상위 (priority <= 본인) 인 role 은 변경 불가
                                                const blocked = role.priority <= currentUserPriority;
                                                return (
                                                    <Box
                                                        key={role.code}
                                                        sx={{
                                                            display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
                                                            px: 1, py: 0.5, borderRadius: 1,
                                                            bgcolor: blocked ? 'action.disabledBackground' : 'action.hover',
                                                            opacity: blocked ? 0.6 : 1,
                                                        }}
                                                    >
                                                        <Box sx={{minWidth: 110}}>
                                                            <Chip
                                                                label={role.name}
                                                                size="small"
                                                                color={getRoleChipColor(role.code)}
                                                            />
                                                        </Box>
                                                        {selected.supportedActions.map(a => (
                                                            <FormControlLabel
                                                                key={a.action}
                                                                control={
                                                                    <Checkbox
                                                                        size="small"
                                                                        checked={cur.has(a.action)}
                                                                        disabled={blocked}
                                                                        onChange={() => toggleAction(role.code, a.action)}
                                                                    />
                                                                }
                                                                label={a.action}
                                                            />
                                                        ))}
                                                        <Button size="small" disabled={blocked} onClick={() => toggleAllForRole(role.code)}>
                                                            {allOn ? '모두 해제' : '모두 선택'}
                                                        </Button>
                                                    </Box>
                                                );
                                            })}
                                        </Stack>
                                        {roles.some(role => role.priority <= currentUserPriority) && (
                                            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 1.5, pl: 0.5}}>
                                                ※ 비활성화된 역할은 본인과 동등하거나 상위 역할로, 권한 변경이 제한됩니다.
                                            </Typography>
                                        )}
                                    </>
                                )}
                            </Box>
                        </Paper>
                    )}
                </Box>
            )}
        </Box>
    );
}
