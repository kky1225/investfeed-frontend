import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";
import StockTable from "../../components/StockTable.tsx";
import Chip from "@mui/material/Chip";
import {useEffect, useState} from "react";
import {fetchStockList} from "../../api/stock/StockApi.ts";
import {Tab, Tabs } from "@mui/material";
import * as React from "react";

const StockList = () => {
    const [value, setValue] = useState(0);
    const [row, setRow] = useState<GridRowsProp[]>([]);

    useEffect(() => {
        stockList();
    }, []);

    const stockList = async () => {
        try {
            const data = await fetchStockList();

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const { stockList } = data.result;

            const ranking = stockList.map(item => {
                return {
                    id: item.stk_cd,
                    rank: item.rank,
                    stk_nm: item.stk_nm,
                    flu_rt: item.flu_rt,
                    cur_prc: item.cur_prc,
                    trde_prica: item.trde_prica,
                }
            });

            setRow(ranking);
        } catch (error) {
            console.log(error);
        }
    }

    function renderStatus(status: number) {
        const colors = status > 0 ? 'error' : 'info';

        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
    }

    // function renderStatus2(status: number) {
    //     const text = status.toLocaleString()
    //
    //     return (
    //         <span style={{color: status > 0 ? 'red' : 'blue'}}>
    //             {status > 0 ? `+${text}` : `${text}`}
    //         </span>
    //     )
    // }

    const columns: GridColDef[] = [
        {
            field: 'rank',
            headerName: '순위',
            flex: 1,
            minWidth: 80,
            maxWidth: 80
        },
        {
            field: 'stk_nm',
            headerName: '주식 이름',
            flex: 1.5,
            minWidth: 180
        },
        {
            field: 'flu_rt',
            headerName: '등락률',
            flex: 0.5,
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as any),
        },
        {
            field: 'cur_prc',
            headerName: '현재가',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => {
                return Number(param).toLocaleString().replace(/^[+-]/, '')
            }
        },
        {
            field: 'trde_prica',
            headerName: '거래대금 (백만)',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => {
                return Number(param).toLocaleString().replace(/^[+-]/, '')
            }
        }
    ];

    function CustomTabPanel(props: TabPanelProps) {
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

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    interface TabPanelProps {
        children?: React.ReactNode;
        index: number;
        value: number;
    }

    function a11yProps(index: number) {
        return {
            id: `simple-tab-${index}`,
            'aria-controls': `simple-tabpanel-${index}`,
        };
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                주식 목록
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                            <Tab label="거래대금 상위" {...a11yProps(0)} />
                            <Tab label="Item Two" {...a11yProps(1)} />
                            <Tab label="Item Three" {...a11yProps(2)} />
                        </Tabs>
                    </Box>
                    <CustomTabPanel value={value} index={0}>
                        <StockTable rows={row} columns={columns} />
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={1}>
                        Item Two
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={2}>
                        Item Three
                    </CustomTabPanel>
                </Box>
            </Grid>
        </Box>
    )
}

export default StockList