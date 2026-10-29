import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {useNavigate} from "react-router-dom";

interface StockTableProps<R extends { id: string }> {
    rows: R[],
    columns: GridColDef[],
    pageSize: number,
    loading?: boolean,
    onRowClick?: (id: string) => void, // 미지정 시 국내 종목 상세로 이동
}

const StockTable = <R extends { id: string }>(
    { rows, columns, pageSize, loading, onRowClick }: StockTableProps<R>
) => {
    const navigate = useNavigate();

    const onClick = (params: { row: { id: string } }) => {
        if (onRowClick) {
            onRowClick(params.row.id);
            return;
        }
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
            loading={loading}
            slotProps={{
                loadingOverlay: {
                    variant: 'skeleton',
                    noRowsVariant: 'skeleton',
                },
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
        />
    )
}

export default StockTable;