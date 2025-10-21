import { useToastStore } from './store.js'

function pushToast(type, message, title) {
  useToastStore.getState().addToast({
    type,
    title,
    message
  })
}

export function toastSuccess(message, title = 'Success') {
  pushToast('success', message, title)
}

export function toastError(message, title = 'Something went wrong') {
  pushToast('error', message, title)
}

export function toastInfo(message, title = 'Notice') {
  pushToast('info', message, title)
}

export function toastWarning(message, title = 'Warning') {
  pushToast('warning', message, title)
}
