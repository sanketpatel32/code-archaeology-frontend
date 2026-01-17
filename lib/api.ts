const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
    data?: unknown;
}

export async function api<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { data, headers, ...rest } = options;

    const config: RequestInit = {
        ...rest,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        credentials: 'include',
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(errorMessage || `HTTP Error: ${response.status}`);
    }

    return response.json();
}

// Convenience methods
export const apiGet = <T>(endpoint: string) => api<T>(endpoint, { method: 'GET' });

export const apiPost = <T>(endpoint: string, data: unknown) =>
    api<T>(endpoint, { method: 'POST', data });

export const apiPut = <T>(endpoint: string, data: unknown) =>
    api<T>(endpoint, { method: 'PUT', data });

export const apiDelete = <T>(endpoint: string) =>
    api<T>(endpoint, { method: 'DELETE' });
