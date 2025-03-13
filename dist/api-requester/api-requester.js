import axios from 'axios';
export default class ApiRequester {
    axiosInstance;
    constructor(baseURL, headers) {
        this.axiosInstance = axios.create({
            baseURL,
            headers,
        });
    }
    async get(url, config) {
        try {
            const response = await this.axiosInstance.get(url, config);
            return response;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async post(url, data, config) {
        try {
            const response = await this.axiosInstance.post(url, data, config);
            return response;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async put(url, data, config) {
        try {
            const response = await this.axiosInstance.put(url, data, config);
            return response;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async delete(url, config) {
        try {
            const response = await this.axiosInstance.delete(url, config);
            return response;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    handleError(error) {
        if (axios.isAxiosError(error)) {
            // Handle Axios-specific errors here
            console.error('Axios error:', error.response?.data);
        }
        else {
            // Handle non-Axios errors here
            console.error('Unexpected error:', error);
        }
        throw error;
    }
}
//# sourceMappingURL=api-requester.js.map