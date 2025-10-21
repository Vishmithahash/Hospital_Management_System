import { useEffect, useState, useCallback } from 'react'
import apiClient from '../app/apiClient'
import { useAuthStore } from '../app/store'

export function useNotifications(options) {
  const defaultPollMs = 30000
  let pollMs = defaultPollMs
  let role

  if (typeof options === 'number') {
    pollMs = options
  } else if (typeof options === 'object' && options !== null) {
    pollMs = options.pollMs ?? defaultPollMs
    role = options.role
  }

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const token = useAuthStore((s) => s.token)

  const load = useCallback(async () => {
    if (!token) {
      // Not authenticated; avoid hitting the API and clear notifications
      setItems([])
      return
    }
    setLoading(true)
    try {
      const { data } = await apiClient.get('/notifications', { params: { unreadOnly: true }, skipErrorToast: true })
      const incoming = Array.isArray(data) ? data : []
      const filtered = role
        ? incoming.filter((n) => !n.audienceRole || n.audienceRole === role)
        : incoming
      setItems(filtered)
    } catch (err) {
      const status = err?.response?.status
      if (status === 401) {
        // Session expired or not logged in; clear items and let global interceptor handle logout
        setItems([])
        return
      }
      // Swallow other errors to avoid unhandled promise rejection in polling
      // Optionally: console.debug('notifications fetch failed', err)
    } finally {
      setLoading(false)
    }
  }, [role, token])

  useEffect(() => {
    load()
    const id = setInterval(load, pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  const markRead = async (id) => {
    await apiClient.post(`/notifications/${id}/read`, null, { skipErrorToast: true })
    setItems((prev) => prev.filter((n) => n._id !== id))
  }

  const markAll = async () => {
    await apiClient.post('/notifications/read-all', null, { skipErrorToast: true })
    setItems([])
  }

  return { items, loading, markRead, markAll, refresh: load, unread: items.length }
}

