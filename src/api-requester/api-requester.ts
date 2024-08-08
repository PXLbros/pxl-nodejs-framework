import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export default class ApiRequester {
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string, headers?: Record<string, string>) {
    this.axiosInstance = axios.create({
      baseURL,
      headers,
    });
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T> | undefined> {
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      return response;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async post<T, R>(url: string, data: T, config?: AxiosRequestConfig): Promise<AxiosResponse<R> | undefined> {
    try {
      const response = await this.axiosInstance.post<R>(url, data, config);
      return response;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async put<T, R>(url: string, data: T, config?: AxiosRequestConfig): Promise<AxiosResponse<R> | undefined> {
    try {
      const response = await this.axiosInstance.put<R>(url, data, config);
      return response;
    } catch (error) {
      this.handleError(error);
    }
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T> | undefined> {
    try {
      const response = await this.axiosInstance.delete<T>(url, config);
      return response;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: any): void {
    if (axios.isAxiosError(error)) {
      // Handle Axios-specific errors here
      console.error('Axios error:', error.response?.data);
    } else {
      // Handle non-Axios errors here
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
