import api from '../../axios.ts';
import type {NewsSearchReq} from '../../type/NewsType.ts';

export const fetchNews = async (req: NewsSearchReq) => {
    const res = await api.post('/news/search', req);
    return res.data;
};
