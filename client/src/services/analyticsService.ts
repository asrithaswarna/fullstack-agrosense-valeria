import { useMockData } from '../config/env'
import { getMockAnalytics } from '../data/mock'
import type { AnalyticsMetricSummary, AnalyticsRange, AnalyticsSummary } from '../types/domain'
import { api } from './api'

export const analyticsService = {
  async getAnalytics(range: AnalyticsRange): Promise<AnalyticsSummary> {
    if (!useMockData) return api.get<AnalyticsSummary>(`/analytics?range=${range}`)
    return {
      range,
      metrics: getMockAnalytics(range),
      generatedAt: new Date().toISOString(),
    }
  },

  async getAnalyticsSummary(range: AnalyticsRange): Promise<AnalyticsMetricSummary[]> {
    if (!useMockData) return api.get<AnalyticsMetricSummary[]>(`/analytics/summary?range=${range}`)
    return (await this.getAnalytics(range)).metrics
  },
}
