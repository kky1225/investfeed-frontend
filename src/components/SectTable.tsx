import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {useNavigate} from "react-router-dom";
import {SectGridRow} from "../type/SectType.ts";

interface SectTableProps {
    rows: SectGridRow[],
    columns: GridColDef[],
    pageSize: number,
}

const SectTable = (
    { rows, columns, pageSize }: SectTableProps
) => {
    const navigate = useNavigate();

    const onClick = (params: { row: { id: string } }) => {
        navigate(`/sect/detail/${params.row.id}`);
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
        />
    )
}

export default SectTable;