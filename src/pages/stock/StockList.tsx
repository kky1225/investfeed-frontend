import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";
import StockTable from "../../components/StockTable.tsx";
import Chip from "@mui/material/Chip";

const StockList = () => {
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
                <StockTable rows={rows} columns={columns} />
            </Grid>
        </Box>
    )
}

export default StockList