import { useCallback, useEffect, useState } from 'react'

export interface AsyncDataState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

type RequestResult<T> = {
  load: () => Promise<T>
  requestId: number
  errorMessage: string
  data: T | null
  error: string | null
}

export function useAsyncData<T>(load: () => Promise<T>, errorMessage: string): AsyncDataState<T> {
  const [requestId, setRequestId] = useState(0)
  const [result, setResult] = useState<RequestResult<T>>({
    load,
    requestId: -1,
    errorMessage,
    data: null,
    error: null,
  })

  const refresh = useCallback(() => setRequestId((current) => current + 1), [])

  useEffect(() => {
    let current = true
    Promise.resolve().then(load).then((data) => {
      if (current) setResult({ load, requestId, errorMessage, data, error: null })
    }).catch((loadError: unknown) => {
      if (current) {
        const message = loadError instanceof Error ? loadError.message : errorMessage
        setResult({ load, requestId, errorMessage, data: null, error: message })
      }
    })

    return () => { current = false }
  }, [errorMessage, load, requestId])

  const currentRequest = result.load === load && result.requestId === requestId && result.errorMessage === errorMessage
  return {
    data: result.load === load ? result.data : null,
    loading: !currentRequest,
    error: currentRequest ? result.error : null,
    refresh,
  }
}
