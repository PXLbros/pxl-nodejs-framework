import { AxiosRequestConfig, AxiosResponse } from 'axios';
export default class ApiRequester {
    private axiosInstance;
    constructor(baseURL: string, headers?: Record<string, string>);
    get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T> | undefined>;
    post<T, R>(url: string, data: T, config?: AxiosRequestConfig): Promise<AxiosResponse<R> | undefined>;
    put<T, R>(url: string, data: T, config?: AxiosRequestConfig): Promise<AxiosResponse<R> | undefined>;
    delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T> | undefined>;
    private handleError;
}
//# sourceMappingURL=api-requester.d.ts.map