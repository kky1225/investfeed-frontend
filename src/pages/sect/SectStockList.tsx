import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";
import {useMemo} from "react";
import {useParams} from "react-router-dom";
import {SectStockGridRow, SectStockListItem, SectStockListReq,} from "../../type/SectType.ts";
import {fetchSectStockList} from "../../api/sect/SectApi.ts";
import SectStockTableProps from "../../components/SectStockTable.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

const DEFAULT_REQ: SectStockListReq = {mrktTp: "0"};

const SectStockList = () => {
    const {indsCd} = useParams();
    const sectIndsCd = indsCd || "001";

    const {data: res, isLoading, lastUpdated, pollError} = usePollingQuery(
        ['sectStockList', sectIndsCd, DEFAULT_REQ.mrktTp],
        (config) => fetchSectStockList(sectIndsCd, DEFAULT_REQ, config),
    );

    const row: SectStockGridRow[] = useMemo(() => {
        if (res?.code !== "0000" || !res.result) return [];
        return (res.result.sectStockList ?? []).map((sectStock: SectStockListItem) => ({
            id: sectStock.stkCd,
            stkNm: sectStock.stkNm,
            fluRt: sectStock.fluRt,
            curPrc: sectStock.curPrc,
            predPreSig: sectStock.predPreSig,
            nowTrdeQty: sectStock.nowTrdeQty,
        }));
    }, [res]);

    const loading = isLoading;

    const columns: GridColDef[] = [
        {
            field: 'index',
            headerName: '번호',
            flex: 1,
            minWidth: 80,
            maxWidth: 80,
            renderCell: (params) => {
                return params.api.getAllRowIds().indexOf(params.id) + 1;
            }
        },
        {
            field: 'stkNm',
            headerName: '주식 이름',
            flex: 1.5,
            minWidth: 180
        },
        {
            field: 'fluRt',
            headerName: '등락률',
            flex: 0.5,
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as number),
        },
        {
            field: 'curPrc',
            headerName: '현재가',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => {
                return Number(param).toLocaleString().replace(/^[+-]/, '')
            }
        },
        {
            field: 'nowTrdeQty',
            headerName: '거래량',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => {
                return Number(param).toLocaleString().replace(/^[+-]/, '')
            }
        }
    ];

    function renderStatus(status: number) {
        const colors = status == 0 ? 'default' : status > 0 ? 'error' : 'info';
        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors}/>;
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    업종 주식 목록
                </Typography>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{mb: (theme) => theme.spacing(2)}}
            >
                <Box sx={{width: '100%'}}>
                    <SectStockTableProps rows={row} columns={columns} pageSize={100} loading={loading}/>
                </Box>
            </Grid>
        </Box>
    );
};

export default SectStockList;
