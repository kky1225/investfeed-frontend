import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {useNavigate} from "react-router-dom";

interface ThemeTableProps {
    rows: ThemeGridRow[],
    columns: GridColDef[],
    pageSize: number,
}

export interface ThemeGridRow {
    id: string;
    rank: string;
    themaNm: string,
    fluSig: string,
    fluRt: string;
    dtPrftRt: string,
}

const ThemeTable = (
    { rows, columns, pageSize }: ThemeTableProps
) => {
    const navigate = useNavigate();

    const onClick = (params: { row: { id: string } }) => {
        navigate(`/theme/${params.row.id}/list`);
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

export default ThemeTable;