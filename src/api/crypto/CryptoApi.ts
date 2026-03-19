import api from "../../axios.ts";
import {CryptoDetailReq} from "../../type/CryptoType.ts";

export const fetchCryptoList = async () => {
    const res = await api.get(`/crypto/list`);
    return res.data;
}

export const fetchCryptoListStream = async () => {
    const res = await api.get(`/crypto/list/stream`);
    return res.data;
}

export const fetchCryptoDetailStream = async (market: string) => {
    const res = await api.get(`/crypto/detail/stream`, {params: {market}});
    return res.data;
}

export const fetchCryptoDetail = async (req: CryptoDetailReq) => {
    const res = await api.get(`/crypto/detail`, {params: req});
    return res.data;
}

export const fetchCryptoSearch = async (keyword: string) => {
    const res = await api.get(`/crypto/search`, {params: {keyword}});
    return res.data;
}
