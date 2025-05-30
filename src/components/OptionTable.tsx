import {DataGrid} from "@mui/x-data-grid";

interface OptionTableTableProps {
    rows: any,
    columns: any
}

const OptionTable = (
    { rows, columns }: OptionTableTableProps
) => {
    return (
        <DataGrid
            rows={rows}
            columns={columns}
            density="compact"
            hideFooter
        />
    )
}

export default OptionTable;