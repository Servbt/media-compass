import type { MediaItem, PickConstraints } from './types'

const eligibleStatuses = new Set(['curious', 'shortlist', 'in_progress'])

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function parseMoodNeedles(value?: string) {
  return (value ?? '')
    .split(',')
    .map(normalize)
    .filter(Boolean)
}

export function getEligibleItems(items: MediaItem[], constraints: PickConstraints) {
  const moodNeedles = parseMoodNeedles(constraints.mood)

  return items.filter((item) => {
    if (!eligibleStatuses.has(item.status)) return false
    if (item.needsReview) return false
    if (constraints.category && constraints.category !== 'any' && item.category !== constraints.category) {
      return false
    }
    if (moodNeedles.length === 0) return true

    return moodNeedles.every((moodNeedle) =>
      item.moods.some((mood) => normalize(mood).includes(moodNeedle)) ||
      item.themes.some((theme) => normalize(theme).includes(moodNeedle)) ||
      item.reason?.toLowerCase().includes(moodNeedle),
    )
  })
}

function daysSince(date: string, now: Date) {
  const created = new Date(date).getTime()
  if (Number.isNaN(created)) return 0
  return Math.max(0, (now.getTime() - created) / 86_400_000)
}

export function getItemWeight(item: MediaItem, now = new Date()) {
  let weight = 1
  weight *= item.status === 'shortlist' ? 2 : 1
  weight *= item.priority / 3
  weight *= Math.min(1.5, 1 + daysSince(item.createdAt, now) / 120)

  if (item.lastPickedAt) {
    const sincePicked = daysSince(item.lastPickedAt, now)
    weight *= sincePicked < 1 ? 0.2 : sincePicked < 7 ? 0.65 : 1
  }

  return weight
}

export function pickMedia(
  items: MediaItem[],
  constraints: PickConstraints,
  random: () => number = Math.random,
) {
  const pool = getEligibleItems(items, constraints).map((item) => ({
    item,
    weight: getItemWeight(item),
  }))
  const picks: MediaItem[] = []

  while (pool.length > 0 && picks.length < 3) {
    const totalWeight = pool.reduce((total, entry) => total + entry.weight, 0)
    let cursor = random() * totalWeight
    let selectedIndex = 0

    for (let index = 0; index < pool.length; index += 1) {
      cursor -= pool[index].weight
      if (cursor <= 0) {
        selectedIndex = index
        break
      }
    }

    picks.push(pool[selectedIndex].item)
    pool.splice(selectedIndex, 1)
  }

  return {
    primary: picks[0] ?? null,
    alternates: picks.slice(1),
  }
}
