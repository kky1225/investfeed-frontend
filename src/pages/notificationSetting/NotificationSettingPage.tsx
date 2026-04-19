import {useEffect, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Switch from "@mui/material/Switch";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
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
    const [setting, setSetting] = useState<NotificationSettingRes | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetchNotificationSetting();
                if (res.result) setSetting(res.result);
            } catch {
                // 기본값 사용
            }
        })();
    }, []);

    const handleToggle = async (key: keyof NotificationSettingRes) => {
        if (!setting) return;
        const updated = {...setting, [key]: !setting[key]};
        setSetting(updated);
        try {
            await saveNotificationSetting(updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            setSetting(setting);
        }
    };

    if (!setting) return null;

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                알림 설정
            </Typography>

            {saved && <Alert severity="success" sx={{mb: 2}}>알림 설정이 저장되었습니다.</Alert>}

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
        </Box>
    );
}
