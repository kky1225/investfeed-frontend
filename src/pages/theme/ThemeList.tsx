import {Box, InputLabel, Select, SelectChangeEvent} from "@mui/material";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import {useEffect, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {ThemeListItem, ThemeListReq} from "../../type/ThemeType.ts";
import {fetchThemeList} from "../../api/theme/ThemeApi.ts";
import ThemeTable, {ThemeGridRow} from "../../components/ThemeTable.tsx";
import {GridColDef} from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";
import NumberSpinner from "../../components/NumberSpinner.tsx";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";

const ThemeList = () => {
    const [req, setReq] = useState<ThemeListReq>({
        dateTp: "1",
        fluPlAmtTp: "3"
    });
    const [row, setRow] = useState<ThemeGridRow[]>([]);
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
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as number),
        }
    ];

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const items = await themeList(req);
            // const sectListStreamReq: SectListStreamReq = {
            //     items: items
            // }

            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if(marketInfo.isMarketOpen) {
                // await sectListStream(sectListStreamReq);
                // socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        // await sectListStream(sectListStreamReq);
                        // socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                themeList(req);
                interval = setInterval(() => {
                    themeList(req);
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            socket?.close();
            clearInterval(socketTimeout);
            clearTimeout(chartTimeout);
            clearInterval(interval);
        }
    }, [req]);

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({
                marketType: MarketType.INDEX
            });

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { time, isMarketOpen, startMarketTime, marketType } = data.result

            if(marketType !== MarketType.INDEX) {
                throw new Error(data.msg);
            }

            const endTime = Date.now();
            const delayTime = endTime - startTime;

            const revisionServerTime = time + delayTime / 2; // startTime과 endTime 사이에 API 응답을 받기 때문에 2를 나눠서 보정

            chartTimer.current = revisionServerTime - endTime;

            if(!isMarketOpen) {
                marketTimer.current = startMarketTime - revisionServerTime;
            }

            return {
                ...data.result
            }
        }catch (error) {
            console.error(error);
        }
    }

    const themeList = async (req: ThemeListReq) => {
        try {
            const data = await fetchThemeList(req);

            console.log(data);

            const { themeList } = data.result;

            const newRowData: ThemeGridRow[] = themeList.map((theme: ThemeListItem, index: number) => {
                return {
                    id: theme.themaGrpCd,
                    rank: index + 1,
                    themaNm: theme.themaNm,
                    fluSig: theme.fluSig,
                    fluRt: theme.fluRt,
                    dtPrftRt: theme.dtPrftRt,
                }
            });

            setRow(newRowData);

            return themeList.map((row: ThemeListItem) => {
                return row.themaGrpCd;
            });
        } catch (error) {
            console.error(error);
        }
    }

    // const sectListStream = async (req: SectListStreamReq) => {
    //     try {
    //         const data = await fetchSectListStream(req);
    //
    //         console.log(data);
    //
    //         if (data.code !== "0000") {
    //             throw new Error(data.msg);
    //         }
    //     } catch (error) {
    //         console.error(error);
    //     }
    // }

    // const openSocket = () => {
    //     const socket = new WebSocket("ws://localhost:8080/ws");
    //
    //     socket.onmessage = (event) => {
    //         const data = JSON.parse(event.data);
    //
    //         if (data.trnm === "REAL" && Array.isArray(data.data)) {
    //             const sectList = data.data.map((entry: SectListStreamRes) => {
    //                 const values = entry.values;
    //                 return {
    //                     code: entry.item, // ex: "001"
    //                     value: values["10"], // 현재가
    //                     change: values["11"], // 전일 대비
    //                     fluRt: values["12"],   // 등락률
    //                     trend: values["25"],   // 등락기호
    //                 };
    //             });
    //
    //             setSectDataList((prevList) => {
    //                 return prevList.map((item) => {
    //                     const newData = sectList.find((data: SectListStream) => data.code === item.id);
    //
    //                     if (newData) {
    //                         return {
    //                             ...item,
    //                             value: newData.value.replace(/^[+-]/, ''),
    //                             fluRt: newData.fluRt,
    //                             trend: trendColor(newData.trend),
    //                         };
    //                     }
    //
    //                     return item;
    //                 });
    //             });
    //         }
    //     };
    //
    //     return socket;
    // }

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
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                테마 목록
            </Typography>
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
                        <ThemeTable rows={row} columns={columns} pageSize={100} />
                    </Grid>
                </Box>
            </Grid>
        </Box>
    )
}

export default ThemeList;