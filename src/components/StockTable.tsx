import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {useNavigate} from "react-router-dom";
import {StockGridRow} from "../type/StockType.ts";

interface StockTableProps {
    rows: StockGridRow[],
    columns: GridColDef[],
    loading: boolean,
    pageSize: number,
}

const StockTable = (
    { rows, columns, loading, pageSize }: StockTableProps
) => {
    const navigate = useNavigate();

    const onClick = (params: { row: { id: string } }) => {
        navigate(`/stock/detail/${params.row.id}`);
    }

    return (
        <DataGrid
            onCellClick={onClick}
            rows={rows}
            columns={columns}
            getRowClassName={(params) =>
                params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
            }
            initialState={{
                pagination: { paginationModel: { pageSize: pageSize } },
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            disableColumnResize
            density="compact"
            slotProps={{
                filterPanel: {
                    filterFormProps: {
                        logicOperatorInputProps: {
                            variant: 'outlined',
                            size: 'small',
                        },
                        columnInputProps: {
                            variant: 'outlined',
                            size: 'small',
                            sx: { mt: 'auto' },
                        },
                        operatorInputProps: {
                            variant: 'outlined',
                            size: 'small',
                            sx: { mt: 'auto' },
                        },
                        valueInputProps: {
                            InputComponentProps: {
                                variant: 'outlined',
                                size: 'small',
                            },
                        },
                    },
                },
            }}
            loading={loading}
        />
    )
}

export default StockTable;