import { create } from 'zustand'

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: crypto.randomUUID(),
          type: toast.type ?? 'info',
          title: toast.title,
          message: toast.message
        }
      ]
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }))
}))

const TOKEN_KEY = 'hospitalms_token'
const initialToken = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null

export const useAuthStore = create((set) => ({
  token: initialToken,
  user: null,
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(TOKEN_KEY, token)
      } else {
        window.localStorage.removeItem(TOKEN_KEY)
      }
    }

    set({ token })
  },
  setUser: (user) => set({ user }),
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY)
    }
    set({ token: null, user: null })
  }
}))
