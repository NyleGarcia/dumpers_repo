import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { catalogIsReward } from '../lib/blueprintOrderable'
import { supabase } from '../lib/supabase'

export function useBlueprintOrderOverrides() {
  const { isSuperAdmin } = useAuth()
  const [overridesMap, setOverridesMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('blueprint_order_overrides')
      .select('blueprint_id, is_orderable')

    if (fetchError) {
      setError(fetchError.message)
      setOverridesMap({})
      setLoading(false)
      return
    }

    const map: Record<string, boolean> = {}
    for (const row of data ?? []) {
      map[row.blueprint_id] = row.is_orderable
    }
    setOverridesMap(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setOrderable = useCallback(
    async (
      blueprintId: string,
      isOrderable: boolean,
      catalogDefault?: boolean
    ): Promise<{ error?: string }> => {
      if (!isSuperAdmin) {
        return { error: 'Super-admin access required' }
      }

      const catalogReward =
        catalogDefault !== undefined ? catalogDefault : catalogIsReward(blueprintId)

      if (isOrderable === catalogReward) {
        const { error: clearError } = await supabase.rpc('clear_blueprint_order_override', {
          p_blueprint_id: blueprintId,
        })
        if (clearError) return { error: clearError.message }

        setOverridesMap((prev) => {
          const next = { ...prev }
          delete next[blueprintId]
          return next
        })
        return {}
      }

      const { error: setError } = await supabase.rpc('set_blueprint_orderable', {
        p_blueprint_id: blueprintId,
        p_is_orderable: isOrderable,
      })
      if (setError) return { error: setError.message }

      setOverridesMap((prev) => ({ ...prev, [blueprintId]: isOrderable }))
      return {}
    },
    [isSuperAdmin]
  )

  return {
    overridesMap,
    loading,
    error,
    refresh,
    setOrderable,
  }
}
