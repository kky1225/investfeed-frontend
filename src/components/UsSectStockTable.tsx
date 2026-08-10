import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {useNavigate} from "react-router-dom";
import {UsSectStockGridRow} from "../type/UsSectType.ts";

interface UsSectStockTableProps {
    rows: UsSectStockGridRow[],
    columns: GridColDef[],
    pageSize: number,
    loading?: boolean,
}

const UsSectStockTableProps = (
    { rows, columns, pageSize, loading }: UsSectStockTableProps
) => {
    const navigate = useNavigate();

    const onClick = (params: { row: { id: string, stexTp: string } }) => {
        navigate(`/us-stock/detail/${params.row.stexTp}/${params.row.id}`);
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

export default UsSectStockTableProps;
