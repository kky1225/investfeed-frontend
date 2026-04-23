import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useEffect, useRef, useState} from "react";
import {useParams} from "react-router-dom";
import {
    SectStockGridRow,
    SectStockListItem,
    SectStockListReq,
} from "../../type/SectType.ts";
import {fetchSectStockList} from "../../api/sect/SectApi.ts";
import SectStockTableProps from "../../components/SectStockTable.tsx";

const SectStockList = () => {
    const { indsCd } = useParams();

    const [req] = useState<SectStockListReq>({
        indsCd: indsCd || "001",
        mrktTp: "0"
    });

    const [row, setRow] = useState<SectStockGridRow[]>([]);
    const [loading, setLoading] = useState(true);
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
    ]

    const chartTimer = useRef<number>(0);

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;

        (async () => {
            await sectStockList(req);

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            chartTimeout = setTimeout(() => {
                sectStockList(req);
                interval = setInterval(() => {
                    sectStockList(req);
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            clearTimeout(chartTimeout);
            clearInterval(interval);
        }
    }, [req]);

    const sectStockList = async (req: SectStockListReq) => {
        try {
            const data = await fetchSectStockList(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const { sectStockList } = data.result;

            const newSectStockList: SectStockGridRow[] = sectStockList.map((sectStock: SectStockListItem) => {
                return {
                    id: sectStock.stkCd,
                    stkNm: sectStock.stkNm,
                    fluRt: sectStock.fluRt,
                    curPrc: sectStock.curPrc,
                    predPreSig: sectStock.predPreSig,
                    nowTrdeQty: sectStock.nowTrdeQty
                }
            })

            setRow(newSectStockList);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    }

    function renderStatus(status: number) {
        const colors = status == 0 ? 'default' : status > 0 ? 'error': 'info';

        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                업종 주식 목록
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Box sx={{ width: '100%' }}>
                    <SectStockTableProps rows={row} columns={columns} pageSize={100} loading={loading} />
                </Box>
            </Grid>
        </Box>
    )
}

export default SectStockList