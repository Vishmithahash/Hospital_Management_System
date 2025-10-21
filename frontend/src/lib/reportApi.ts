import dayjs from 'dayjs'
import apiClient from '../app/apiClient.js'

export type ReportType = 'DAILY_VISITS' | 'APPT_LOAD' | 'PEAK_HOURS' | 'PAYMENT_SUMMARY'

export interface ReportRange { from: string; to: string }
export interface ReportFilters {
  departmentId?: string
  branchId?: string
  doctorId?: string
  paymentMethod?: 'CARD' | 'CASH' | 'GOVERNMENT'
}

export interface GeneratePayload {
  type: ReportType
  range: ReportRange
  filters?: ReportFilters
  preview?: boolean
  regenerate?: boolean
}

export const TZ = 'Asia/Colombo'

export function defaultRange(days = 7): ReportRange {
  return {
    from: dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  }
}

export async function getOptions() {
  const { data } = await apiClient.get('/reports/options')
  return data as { departments: string[]; branches: string[]; doctors: { id: string; name: string }[] }
}

export async function generateReport(payload: GeneratePayload) {
  const { data } = await apiClient.post('/reports/generate', payload, { skipErrorToast: true })
  return data as {
    meta: any
    table: { columns: string[]; rows: any[] }
    chart: { kind: 'bar' | 'line' | 'stacked' | 'heatmap'; series: any; xAxis: any; yAxis: any }
  }
}

export async function exportReport(payload: GeneratePayload & { format: 'pdf' | 'xlsx'; chartImage?: string }) {
  const { data, headers } = await apiClient.post('/reports/export', payload, { responseType: 'blob' })
  return { blob: data as Blob, headers }
}

