import { useState } from 'react'

export const FAVORITE_GROUPS_KEY = 'arc-portal-favorite-groups'

export function useFavoriteGroups() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(FAVORITE_GROUPS_KEY) ?? '[]')
      return new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : [])
    } catch { return new Set() }
  })
  const toggleFavorite = (key: string) => {
    const next = new Set(favorites)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setFavorites(next)
    try { localStorage.setItem(FAVORITE_GROUPS_KEY, JSON.stringify([...next])) } catch { /* Keep the in-memory preference. */ }
  }
  return { favorites, toggleFavorite }
}
