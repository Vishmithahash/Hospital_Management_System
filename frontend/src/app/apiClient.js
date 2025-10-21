import axios from 'axios'
import { useAuthStore } from './store'
import { toastError } from './toastHelpers.js'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token

  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    }
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const skipToast = error.config?.skipErrorToast
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Request failed'

    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }

    if (!skipToast) {
      toastError(message, 'Request error')
    }

    return Promise.reject(error)
  }
)

export default apiClient
