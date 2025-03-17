interface FetchOptions extends RequestInit {
  token?: boolean
  data?: any
}

class ApiClient {
  private async request<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const { token = true, data, ...customOptions } = options

    // Configuração padrão
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "69420",
    }

    // Adiciona token de autenticação se necessário
    if (token) {
      const authToken = typeof window !== "undefined" ? sessionStorage.getItem("auth-token") : null
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`
      }
    }

    // Configuração final
    const config: RequestInit = {
      ...customOptions,
      headers: {
        ...headers,
        ...customOptions.headers,
      },
    }

    // Adiciona corpo da requisição se houver dados
    if (data) {
      config.body = JSON.stringify(data)
    }

    try {

      const response = await fetch(url, config)
      console.log(config, '\t fetch')
      // Verifica se a resposta é bem-sucedida
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Erro na requisição: ${response.status}`)
      }

      // Retorna os dados da resposta
      return await response.json()
    } catch (error) {
      console.error("Erro na API:", error)
      throw error
    }
  }

  // Métodos HTTP
  async get<T>(url: string, options: FetchOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: "GET" })
  }

  async post<T>(url: string, data: any, options: FetchOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: "POST", data })
  }

  async put<T>(url: string, data: any, options: FetchOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: "PUT", data })
  }

  async delete<T>(url: string, options: FetchOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: "DELETE" })
  }
}

// Exporta uma instância única do cliente de API
export const apiClient = new ApiClient()

