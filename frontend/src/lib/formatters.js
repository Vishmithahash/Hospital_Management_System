import dayjs from 'dayjs'

export function formatDate(input) {
  if (!input) return ''
  return dayjs(input).format('YYYY-MM-DD')
}

export function formatDateTime(input) {
  if (!input) return ''
  return dayjs(input).format('YYYY-MM-DD HH:mm')
}

export function formatCurrency(amount) {
  if (typeof amount !== 'number') {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

export function downloadBlob(data, filename, mime = 'text/csv') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
