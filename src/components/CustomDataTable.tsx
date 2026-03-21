import {useMemo} from "react";
import Box from "@mui/material/Box";
import {DataGrid, GridColDef} from "@mui/x-data-grid";

interface CustomDataTableProps {
    rows: any,
    columns: GridColDef[],
    pageSize: number,
}

const calcHeaderMinWidth = (headerName: string): number => {
    let width = 0;
    for (const ch of headerName) {
        if (ch === ' ') width += 5;
        else if (/[\u3131-\uD79D]/.test(ch)) width += 16;
        else width += 9;
    }
    return width + 50;
};

const CustomDataTable = (
    { rows, columns }: CustomDataTableProps
) => {
    const adjustedColumns = useMemo(() =>
        columns.map(col => {
            const headerMin = calcHeaderMinWidth(col.headerName ?? '');
            const currentMin = col.minWidth ?? col.width ?? 100;
            return {
                ...col,
                minWidth: Math.max(currentMin, headerMin),
            };
        }),
    [columns]);

    const totalMinWidth = adjustedColumns.reduce((sum, col) => sum + (col.minWidth ?? 100), 0) + 48;

    return (
        <Box sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
        <DataGrid
            checkboxSelection
            rows={rows}
            columns={adjustedColumns}
            getRowClassName={(params) =>
                params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
            }
            initialState={{
                pagination: { paginationModel: { pageSize: 20 } },
            }}
            pageSizeOptions={[10, 20, 50]}
            disableColumnResize
            density="compact"
            sx={{ minWidth: totalMinWidth }}
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
        </Box>
    )
}

export default CustomDataTable;
