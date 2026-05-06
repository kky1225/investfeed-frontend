import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Switch from "@mui/material/Switch";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import {fetchNotificationSetting, saveNotificationSetting} from "../../api/notification/NotificationApi.ts";
import type {NotificationSettingRes} from "../../type/NotificationSettingType.ts";

interface SettingItem {
    key: keyof NotificationSettingRes;
    label: string;
    description: string;
}

interface SettingGroup {
    title: string;
    items: SettingItem[];
}

const settingGroups: SettingGroup[] = [
    {
        title: '주식 정보 알림',
        items: [
            {key: 'priceUpEnabled', label: '상승률 알림', description: '관심종목/보유종목 가격이 5%, 10%, 15%, 20% 이상 상승 시'},
            {key: 'priceDownEnabled', label: '하락률 알림', description: '관심종목/보유종목 가격이 5%, 10%, 15%, 20% 이상 하락 시'},
            {key: 'high52wEnabled', label: '52주 최고가 알림', description: '관심종목/보유종목이 52주 최고가를 달성했을 때'},
            {key: 'low52wEnabled', label: '52주 최저가 알림', description: '관심종목/보유종목이 52주 최저가를 달성했을 때'},
            {key: 'upperLimitEnabled', label: '상한가 알림', description: '관심종목/보유종목이 상한가에 도달했을 때'},
            {key: 'lowerLimitEnabled', label: '하한가 알림', description: '관심종목/보유종목이 하한가에 도달했을 때'},
        ],
    },
    {
        title: '투자 목표 알림',
        items: [
            {key: 'goalEnabled', label: '목표 달성 알림', description: '설정한 투자 목표(총 자산, 월간/연간 실현손익)를 달성했을 때'},
        ],
    },
    {
        title: '리밸런싱 알림',
        items: [
            {key: 'rebalancingEnabled', label: '비중 초과 알림', description: '포트폴리오 비중이 설정한 목표를 벗어났을 때'},
        ],
    },
    {
        title: 'API Key 알림',
        items: [
            {key: 'apiKeyEnabled', label: '유효기간 만료 알림', description: 'API Key 만료 30일 전, 7일 전, 당일에 알림'},
        ],
    },
];

export default function NotificationSettingPage() {
    const queryClient = useQueryClient();
    const [saved, setSaved] = useState(false);

    const {data: setting, isLoading: loading} = useQuery<NotificationSettingRes | null>({
        queryKey: ['notificationSetting'],
        queryFn: async ({signal}) => requireOk<NotificationSettingRes | null>(await fetchNotificationSetting({signal, skipGlobalError: true}), null),
        // optimistic toggle 과의 race condition 방지
        refetchOnWindowFocus: false,
    });

    const handleToggle = async (key: keyof NotificationSettingRes) => {
        if (!setting) return;
        const updated = {...setting, [key]: !setting[key]};
        // optimistic update
        queryClient.setQueryData<NotificationSettingRes | null>(['notificationSetting'], updated);
        try {
            const res = await saveNotificationSetting(updated);
            if (res.code !== "0000") throw new Error(res.message || `알림 설정 저장 실패 (${res.code})`);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error(error);
            queryClient.setQueryData<NotificationSettingRes | null>(['notificationSetting'], setting);
        }
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                알림 설정
            </Typography>

            {saved && <Alert severity="success" sx={{mb: 2}}>알림 설정이 저장되었습니다.</Alert>}

            {loading ? (
                <Stack spacing={3}>
                    {settingGroups.map((group) => (
                        <Card variant="outlined" key={group.title}>
                            <CardContent>
                                <Skeleton width={100} height={20} sx={{mb: 1}}/>
                                <Stack spacing={0}>
                                    {group.items.map((item, index) => (
                                        <Box key={item.key} sx={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            py: 1.5,
                                            borderBottom: index < group.items.length - 1 ? '1px solid' : 'none',
                                            borderColor: 'divider',
                                        }}>
                                            <Box sx={{flex: 1}}>
                                                <Skeleton width={120} sx={{mb: 0.5}}/>
                                                <Skeleton width="80%"/>
                                            </Box>
                                            <Skeleton variant="rounded" width={32} height={18} sx={{ml: 2}}/>
                                        </Box>
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            ) : setting ? (
            <Stack spacing={3}>
                {settingGroups.map((group) => (
                    <Card variant="outlined" key={group.title}>
                        <CardContent>
                            <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary', mb: 1}}>
                                {group.title}
                            </Typography>
                            <Stack spacing={0}>
                                {group.items.map((item, index) => (
                                    <Box key={item.key} sx={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        py: 1.5,
                                        borderBottom: index < group.items.length - 1 ? '1px solid' : 'none',
                                        borderColor: 'divider',
                                    }}>
                                        <Box>
                                            <Typography variant="body2" sx={{fontWeight: 600}}>{item.label}</Typography>
                                            <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                                        </Box>
                                        <Switch
                                            checked={setting[item.key]}
                                            onChange={() => handleToggle(item.key)}
                                            size="small"
                                        />
                                    </Box>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                ))}
            </Stack>
            ) : (
                <Alert severity="error">알림 설정을 불러오지 못했습니다.</Alert>
            )}
        </Box>
    );
}
