const env = import.meta.env

export const apiBaseUrl = (env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export const realtimeServerUrl = env.VITE_SOCKET_URL || ''
export const useMockData = env.VITE_USE_MOCK_DATA === 'true'
