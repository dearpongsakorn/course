import { useEffect, useState, type DependencyList } from 'react'

export function useApi<T>(loader: () => Promise<T>, dependencies: DependencyList = [], initialData: T | null = null) {
  const [data, setData] = useState<T | null>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    let active = true

    queueMicrotask(() => {
      if (!active) return

      setLoading(true)
      setError(null)

      loader()
        .then((result) => {
          if (active) setData(result)
        })
        .catch((currentError: Error) => {
          if (active) setError(currentError.message)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    })

    return () => {
      active = false
    }
    // Callers pass a stable dependency list for each API request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  return { data, error, loading }
}
