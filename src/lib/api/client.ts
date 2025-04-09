interface FetchOptions extends RequestInit {
  token?: boolean;
  data?: unknown;
}

class ApiClient {
  private async request<T>(
    url: string,
    options: FetchOptions = {},
  ): Promise<T> {
    const { token = true, data, ...customOptions } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      // 'ngrok-skip-browser-warning': '69420', // usar apenas quando Ngrok estiver sendo utilizado
    };

    if (token) {
      const authToken =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('auth-token')
          : null;
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
    }

    const config: RequestInit = {
      ...customOptions,
      headers: {
        ...headers,
        ...customOptions.headers,
      },
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Erro na requisição: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async get<T>(url: string, options: FetchOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T>(
    url: string,
    data: unknown,
    options: FetchOptions = {},
  ): Promise<T> {
    return this.request<T>(url, { ...options, method: 'POST', data });
  }

  async put<T>(
    url: string,
    data: unknown,
    options: FetchOptions = {},
  ): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PUT', data });
  }

  async patch<T>(
    url: string,
    options: FetchOptions = {},
  ): Promise<T> {
    return this.request<T>(url, { ...options, method: 'PATCH'});
  }

  async delete<T>(url: string, options: FetchOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
