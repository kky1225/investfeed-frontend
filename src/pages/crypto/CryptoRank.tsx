import {useEffect, useMemo, useRef, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import {DataGrid} from "@mui/x-data-grid";
import {fetchCryptoRankList, fetchCryptoRankStream} from "../../api/crypto/CryptoApi.ts";
import {CryptoRankItem} from "../../type/CryptoType.ts";
import {unwrapResponse} from "../../lib/apiResponse.ts";
import {useNavigate} from "react-router-dom";
import {renderChip} from "../../components/CustomRender.tsx";

interface CryptoRankRow {
    id: string;
    rank: number;
    koreanName: string;
    tradePrice: number;
    signedChangeRate: number;
    change: string;
    accTradePrice24h: number;
}

interface CryptoTickerStream {
    market: string;
    tradePrice: number;
    signedChangeRate: number;
    change: string;
    accTradePrice24h: number;
}

const formatAccTradePrice = (value: number): string => {
    if (value >= 1_000_000_000_000) {
        return `${(value / 1_000_000_000_000).toFixed(1)}조`;
    } else if (value >= 100_000_000) {
        return `${(value / 100_000_000).toFixed(0)}억`;
    } else if (value >= 10_000) {
        return `${(value / 10_000).toFixed(0)}만`;
    }
    return value.toLocaleString();
};

const columns: GridColDef[] = [
    {
        field: 'rank',
        headerName: '순위',
        flex: 1,
        minWidth: 80,
        maxWidth: 80,
    },
    {
        field: 'koreanName',
        headerName: '코인명',
        flex: 1.5,
        minWidth: 120,
    },
    {
        field: 'signedChangeRate',
        headerName: '등락률',
        flex: 0.5,
        minWidth: 100,
        renderCell: (params) => renderChip(Number((params.value * 100).toFixed(2))),
    },
    {
        field: 'tradePrice',
        headerName: '현재가',
        flex: 1,
        minWidth: 120,
        valueFormatter: (param: number) => Number(param).toLocaleString(),
    },
    {
        field: 'accTradePrice24h',
        headerName: '거래대금(24H)',
        flex: 1,
        minWidth: 140,
        valueFormatter: (param: number) => formatAccTradePrice(param),
    },
];

const CryptoRank = () => {
    const navigate = useNavigate();
    const [liveOverlay, setLiveOverlay] = useState<Map<string, CryptoTickerStream>>(new Map());
    const bufferMap = useRef<Map<string, CryptoTickerStream>>(new Map());

    const {data: items, isLoading: loading} = useQuery<CryptoRankItem[]>({
        queryKey: ['cryptoRankList'],
        queryFn: async ({signal}) => unwrapResponse(await fetchCryptoRankList({signal, skipGlobalError: true}), [] as CryptoRankItem[]),
    });

    const rows: CryptoRankRow[] = useMemo(() => {
        if (!items) return [];
        return items.map((item, index) => {
            const live = liveOverlay.get(item.market);
            return {
                id: item.market,
                rank: index + 1,
                koreanName: item.koreanName,
                tradePrice: live?.tradePrice ?? item.tradePrice,
                signedChangeRate: live?.signedChangeRate ?? item.signedChangeRate,
                change: live?.change ?? item.change,
                accTradePrice24h: live?.accTradePrice24h ?? item.accTradePrice24h,
            };
        });
    }, [items, liveOverlay]);

    // WebSocket 라이프사이클 (스트림 등록 + buffer flush)
    useEffect(() => {
        let displayInterval: ReturnType<typeof setInterval>;
        let socket: WebSocket | undefined;

        (async () => {
            try {
                await fetchCryptoRankStream();
            } catch (e) {
                console.error(e);
            }

            socket = new WebSocket("ws://localhost:8080/ws");
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "CRYPTO_TICKER") {
                    bufferMap.current.set(data.market, {
                        market: data.market,
                        tradePrice: data.tradePrice,
                        signedChangeRate: data.signedChangeRate,
                        change: data.change,
                        accTradePrice24h: data.accTradePrice24h,
                    });
                }
            };

            // 500ms 단위로 buffer flush → liveOverlay 갱신 (렌더 빈도 조절)
            displayInterval = setInterval(() => {
                if (bufferMap.current.size === 0) return;
                setLiveOverlay((prev) => {
                    const next = new Map(prev);
                    bufferMap.current.forEach((v, k) => next.set(k, v));
                    return next;
                });
                bufferMap.current.clear();
            }, 500);
        })();

        return () => {
            if (displayInterval) clearInterval(displayInterval);
            socket?.close();
        };
    }, []);

    const onClick = (params: { row: { id: string } }) => {
        navigate(`/crypto/detail/${params.row.id}`);
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                코인 거래대금 순위
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{mb: (theme) => theme.spacing(2)}}
            >
                <Box sx={{width: '100%'}}>
                    <DataGrid
                        onCellClick={onClick}
                        rows={rows}
                        columns={columns}
                        getRowClassName={(params) =>
                            params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
                        }
                        initialState={{
                            pagination: {paginationModel: {pageSize: 50}},
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
                                        sx: {mt: 'auto'},
                                    },
                                    operatorInputProps: {
                                        variant: 'outlined',
                                        size: 'small',
                                        sx: {mt: 'auto'},
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
            </Grid>
        </Box>
    );
};

export default CryptoRank;
