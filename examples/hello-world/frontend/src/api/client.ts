/**
 * API Client
 * Type-safe fetch wrapper for calling the PXL backend
 */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * API Response Types
 */
export interface PingResponse {
  status: string;
  message: string;
  timestamp: string;
}

export interface HelloResponse {
  message: string;
  timestamp: string;
  receivedName: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
}

export interface InfoResponse {
  name: string;
  version: string;
  framework: string;
  endpoints: ApiEndpoint[];
}

/**
 * Make a GET request to the API
 */
export async function get<T = unknown>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Make a POST request to the API
 */
export async function post<T = unknown, D = unknown>(endpoint: string, data: D): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
