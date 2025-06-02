import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import {CustomLineChartProps} from "../../components/InvestorLineChart.tsx";
import { useState, MouseEvent } from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {
    toggleButtonGroupClasses,
} from '@mui/material/ToggleButtonGroup';
import {styled} from "@mui/material/styles";
import {Divider, Select, SelectChangeEvent} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import DetailChart from "../../components/DetailChart.tsx";

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    border: 'none',
    boxShadow: 'none',
    [`& .${toggleButtonGroupClasses.grouped}`]: {
        border: 0,
        borderRadius: theme.shape.borderRadius,
        [`&.${toggleButtonGroupClasses.disabled}`]: {
            border: 0,
        },
    },
    [`& .${toggleButtonGroupClasses.middleButton},& .${toggleButtonGroupClasses.lastButton}`]:
        {
            marginLeft: -1,
            borderLeft: '1px solid transparent',
        },
}));

const IndexDetail = () => {
    const data: CustomLineChartProps = {
        seriesData: [
            {
                id: 'direct',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'red',
                data: [
                    2644.4, 2634.4, 2604.7, 2601.2, 2600.3, 2612.4, 2603.4, 2591.5, 2594.8, 2591.2, 2589.9, 2593.4,
                    2599.4, 2604.4, 2614.3, 2619.6, 2621.3, 2626.3, 2633.9, 2635.5, 2635.9, 2644.4, 2649.3,
                    2653.5, 2655.7, 2661.4, 2666.6, 2669.1, 2670.4, 2673.4, 2680.8
                ],
            },
        ]
    }

    const data2: CombinedChartProps = {
        lineSeriesData: [
            {
                id: 'direct',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'red',
                data: [
                    2644.4, 2634.4, 2604.7, 2601.2, 2600.3, 2612.4, 2603.4, 2591.5, 2594.8, 2591.2, 2589.9, 2593.4,
                    2599.4, 2604.4, 2614.3, 2619.6, 2621.3, 2626.3, 2633.9, 2635.5, 2635.9, 2644.4, 2649.3,
                    2653.5, 2655.7, 2661.4, 2666.6, 2669.1, 2670.4, 2673.4, 2680.8
                ],
            }
        ],
        barSeriesData: [
            {
                id: 'volume',
                type: 'bar',
                color: '#90caf9',
                data: [
                    105000, 98000, 112000, 102000, 95000, 100000, 99000, 101000, 97000, 94000,
                    95000, 96000, 97000, 99000, 103000, 108000, 110000, 107000, 104000, 101000,
                    99000, 97000, 95000, 93000, 91000, 89000, 87000, 85000, 83000, 81000, 80000
                ],
            }
        ]
    };

    const [alignment, setAlignment] = useState('day');
    const [formats, setFormats] = useState('candle');
    const [minute, setMinute] = useState('1');

    const handleFormat = (
        _event: MouseEvent<HTMLElement>,
        newFormats: string,
    ) => {
        setFormats(newFormats);
    };

    const handleAlignment = (
        _event: MouseEvent<HTMLElement>,
        newAlignment: string,
    ) => {
        if(newAlignment !== null) {
            setAlignment(newAlignment);
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        setMinute(event.target.value as string)
    }


    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                코스피
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid size={{ xs: 12, md: 12 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                코스피
                            </Typography>
                            <Stack sx={{ justifyContent: 'space-between' }}>
                                <Stack
                                    direction="row"
                                    sx={{
                                        alignContent: { xs: 'center', sm: 'flex-start' },
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    <Typography variant="h4" component="p">
                                        2,644.4
                                    </Typography>
                                    <Chip size="small" color="error" label='+2.02%' />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    2025.05.26 08:30
                                </Typography>
                            </Stack>
                        </CardContent>
                        <DetailChart />
                        <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            flexWrap="wrap"
                        >
                            <StyledToggleButtonGroup
                                size="small"
                                value={alignment}
                                exclusive
                                onChange={handleAlignment}
                                aria-label="text alignment"
                            >
                                <ToggleButton
                                    value="minute"
                                    key="minute"
                                    aria-label="minute"
                                    sx={{
                                        padding: 1
                                    }}
                                >
                                    <Select
                                        size="small"
                                        value={minute}
                                        onChange={handleOptionChange}
                                        variant="standard"
                                        disableUnderline
                                        sx={{
                                            boxShadow: 'none',
                                            width: 55,
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            padding: '0 8px',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <MenuItem value="1">1분</MenuItem>
                                        <MenuItem value="3">3분</MenuItem>
                                        <MenuItem value="5">5분</MenuItem>
                                        <MenuItem value="15">15분</MenuItem>
                                        <MenuItem value="30">30분</MenuItem>
                                        <MenuItem value="60">60분</MenuItem>
                                    </Select>
                                </ToggleButton>
                                <ToggleButton value="day" key="day" aria-label="day">일</ToggleButton>
                                <ToggleButton value="week" key="week" aria-label="week">주</ToggleButton>
                                <ToggleButton value="month" key="month" aria-label="month">월</ToggleButton>
                                <ToggleButton value="year" key="year" aria-label="year">년</ToggleButton>
                            </StyledToggleButtonGroup>

                            <StyledToggleButtonGroup
                                size="small"
                                value={formats}
                                exclusive
                                onChange={handleFormat}
                                aria-label="text formatting"
                            >
                                <ToggleButton value="candle" key="candle" aria-label="candle">
                                    <CandlestickChartIcon />
                                </ToggleButton>
                                <ToggleButton value="line" key="line" aria-label="line">
                                    <StackedLineChartIcon />
                                </ToggleButton>
                            </StyledToggleButtonGroup>
                        </Box>
                    </Card>
                </Grid>
            </Grid>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                상세 정보
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Grid container spacing={2}>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        거래량
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        3억 2,031만주
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        거래대금
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        9,031억원
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        3억 2,031만주
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom>
                                        종가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        9,031억원
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    )
}

export default IndexDetail;