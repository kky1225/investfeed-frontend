import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import {ReactNode, SyntheticEvent, useState} from "react";
import Typography from "@mui/material/Typography";
import AddIcon from '@mui/icons-material/Add';
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import CustomDataTable from "../../components/CustomDataTable.tsx";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";

const Interest = () => {
    const [group, setGroup] = useState(0);

    function renderStatus(status: number) {
        const colors = status > 0 ? 'error' : 'info';

        return <Chip label={status > 0 ? `+${status}%` : `${status}%`} color={colors} />;
    }

    function renderStatus2(status: number) {
        const text = status.toLocaleString()

        return (
            <span style={{color: status > 0 ? 'red' : 'blue'}}>
                {status > 0 ? `+${text}` : `${text}`}
            </span>
        )
    }

    const columns: GridColDef[] = [
        { field: 'pageTitle', headerName: '이름', flex: 1.5, minWidth: 180 },
        {
            field: 'status',
            headerName: '주가',
            flex: 0.5,
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as any),
        },
        {
            field: 'eventCount',
            headerName: '금액',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => {
                return param.toLocaleString()
            }
        },
        {
            field: 'users',
            headerName: '증감률',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderStatus2(params.value as any),
        }
    ];

    const rows: GridRowsProp = [
        {
            id: 1,
            pageTitle: 'SK하이닉스',
            status: 4.2,
            eventCount: 212000,
            users: 4000
        },
        {
            id: 2,
            pageTitle: '삼성전자',
            status: 3.3,
            eventCount: 56100,
            users: 300
        },
        {
            id: 3,
            pageTitle: '삼성물산',
            status: 2.4,
            eventCount: 154600,
            users: 3700
        },
        {
            id: 4,
            pageTitle: '현대건설',
            status: 2.0,
            eventCount: 67600,
            users: 6800
        },
        {
            id: 5,
            pageTitle: '현대차',
            status: 1.8,
            eventCount: 190800,
            users: 5400
        },
    ];

    const rows1: GridRowsProp = [
        {
            id: 1,
            pageTitle: 'KODEX 코스피',
            status: 2.0,
            eventCount: 27730,
            users: 570
        },
        {
            id: 2,
            pageTitle: 'KODEX 200',
            status: 1.9,
            eventCount: 36490,
            users: 710
        },
        {
            id: 3,
            pageTitle: 'KODEX 200선물인버스2X',
            status: -3.38,
            eventCount: 1873,
            users: -76
        },
        {
            id: 4,
            pageTitle: 'KODEX 2차전지산업레버리지',
            status: 3.0,
            eventCount: 751,
            users: 22
        },
    ];

    const rows3: GridRowsProp = [
        {
            id: 1,
            pageTitle: 'LG에너지솔루션',
            status: 4.2,
            eventCount: 212000,
            users: 4000
        },
        {
            id: 2,
            pageTitle: '삼성SDI',
            status: 3.3,
            eventCount: 56100,
            users: 4000
        },
    ];

    function handleChange(_event: SyntheticEvent, newValue: number) {
        setGroup(newValue);
    }

    function a11yProps(index: number) {
        return {
            id: `simple-tab-${index}`,
            'aria-controls': `simple-tabpanel-${index}`,
        };
    }

    interface TabPanelProps {
        children?: ReactNode;
        index: number;
        value: number;
    }

    function TabPanel(props: TabPanelProps) {
        const { children, value, index, ...other } = props;

        return (
            <div
                role="tabpanel"
                hidden={value !== index}
                id={`simple-tabpanel-${index}`}
                aria-labelledby={`simple-tab-${index}`}
                {...other}
            >
                {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
            </div>
        );
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                관심 종목
            </Typography>
            <Stack
                direction="row"
                sx={{
                    alignContent: { xs: 'center', sm: 'flex-start' },
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                <Tabs
                    value={group}
                    onChange={handleChange}
                    aria-label="media"
                    variant="scrollable"
                    allowScrollButtonsMobile
                    sx={{minWidth: 250}}
                >
                    <Tab label="주식" value={0} {...a11yProps(0)} />
                    <Tab label="ETF" value={1} {...a11yProps(1)} />
                    <Tab label="반도체" value={2} {...a11yProps(2)} />
                    <Tab label="이차전지" value={3} {...a11yProps(3)} />
                    <Tab label="인버스" value={4} {...a11yProps(4)} />
                    <Tab label="인버스" value={5} {...a11yProps(5)} />
                    <Tab label="인버스" value={6} {...a11yProps(6)} />
                    <Tab label="인버스" value={7} {...a11yProps(7)} />
                    <Tab label="인버스" value={8} {...a11yProps(8)} />
                </Tabs>
                <IconButton aria-label="add" size="small" color="primary">
                    <AddIcon />
                </IconButton>
            </Stack>
            <TabPanel index={0} value={group}>
                <CustomDataTable rows={rows} columns={columns} />
            </TabPanel>
            <TabPanel index={1} value={group}>
                <CustomDataTable rows={rows1} columns={columns} />
            </TabPanel>
            <TabPanel index={3} value={group}>
                <CustomDataTable rows={rows3} columns={columns} />
            </TabPanel>
        </Box>
    )
}

export default Interest;