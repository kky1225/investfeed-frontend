import {Box, InputLabel, Select, SelectChangeEvent} from "@mui/material";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import {useState} from "react";
import {ThemeGridRow, ThemeListItem, ThemeListReq} from "../../type/ThemeType.ts";
import {fetchThemeList} from "../../api/theme/ThemeApi.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import ThemeTable from "../../components/ThemeTable.tsx";
import {GridColDef} from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";
import NumberSpinner from "../../components/NumberSpinner.tsx";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

const ThemeList = () => {
    const [req, setReq] = useState<ThemeListReq>({
        dateTp: "1",
        fluPlAmtTp: "3"
    });

    const {data, isLoading, lastUpdated, pollError} = usePollingQuery(
        ['themeList', req],
        (config) => fetchThemeList(req, config),
    );

    const row: ThemeGridRow[] = (data?.result?.themeList ?? []).map(
        (theme: ThemeListItem, index: number) => ({
            id: theme.themaGrpCd,
            rank: index + 1,
            themaNm: theme.themaNm,
            fluSig: theme.fluSig,
            fluRt: theme.fluRt,
            dtPrftRt: theme.dtPrftRt,
        })
    );

    const columns: GridColDef[] = [
        {
            field: 'rank',
            headerName: '순위',
            flex: 1,
            minWidth: 80,
            maxWidth: 80
        },
        {
            field: 'themaNm',
            headerName: '테마명',
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
            field: 'dtPrftRt',
            headerName: '기간 수익률',
            flex: 1,
            minWidth: 120,
            renderCell: (params) => renderStatus(params.value as number),
        }
    ];

    function renderStatus(status: number) {
        const colors = status == 0 ? 'default' : status > 0 ? 'error': 'info';

        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
    }

    function onChangeSelected(value: number | null) {
        if(value) {
            const newReq: ThemeListReq = {
                dateTp: value.toString(),
                fluPlAmtTp: req.fluPlAmtTp
            }

            setReq(newReq);
        }
    }

    function handleChange(event: SelectChangeEvent) {
        const value = event.target.value;

        if(value === "1" || value === "3") {
            const newReq: ThemeListReq = {
                dateTp: req.dateTp,
                fluPlAmtTp: value
            }

            setReq(newReq);
        }
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    테마 목록
                </Typography>
                <Box sx={{ flex: 1 }}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid container spacing={2} sx={{ alignItems: 'flex-end', mb: 2 }}>
                    <Grid>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel id="fluPlAmtTp">정렬</InputLabel>
                            <Select
                                labelId="fluPlAmtTp"
                                id="fluPlAmtTp"
                                value={req.fluPlAmtTp}
                                onChange={handleChange}
                                label="정렬"
                            >
                                <MenuItem value="1">기간 수익률</MenuItem>
                                <MenuItem value="3">등락률</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <NumberSpinner
                                label="기간"
                                min={1}
                                max={99}
                                defaultValue={1}
                                onValueChange={onChangeSelected}
                            />
                        </Box>
                    </Grid>
                </Grid>
                <Box sx={{ width: '100%' }}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{ mt: 1, mb: (theme) => theme.spacing(2) }}
                    >
                        <ThemeTable rows={row} columns={columns} pageSize={100} loading={isLoading} />
                    </Grid>
                </Box>
            </Grid>
        </Box>
    )
}

export default ThemeList;
