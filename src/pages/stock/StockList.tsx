import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";
import StockTable from "../../components/StockTable.tsx";
import Chip from "@mui/material/Chip";
import {useEffect, useState} from "react";
import {fetchStockList} from "../../api/stock/StockApi.ts";

const StockList = () => {
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

            const { trde_prica_upper } = data.result;

            const ranking = trde_prica_upper.map(item => {
                return {
                    id: item.stk_cd,
                    rank: item.now_rank,
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
                <StockTable rows={row} columns={columns} />
            </Grid>
        </Box>
    )
}

export default StockList