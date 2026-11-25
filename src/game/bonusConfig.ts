import { BONUS } from './probabilityConfig'
export { BONUS } from './probabilityConfig'

if (!Number.isFinite(BONUS.landingChance) || BONUS.landingChance < 0 || BONUS.landingChance > 1) {
  throw new RangeError('The Hold & Spin landing chance must be between zero and one.')
}

export function binomial(trials: number, chance: number) {
  let combinations = 1
  return Array.from({ length: trials + 1 }, (_, hits) => {
    const probability = combinations * chance ** hits * (1 - chance) ** (trials - hits)
    combinations *= (trials - hits) / (hits + 1)
    return probability
  })
}

export function bonusEntryChance(cells: number, orbChance: number) {
  return binomial(cells, orbChance).slice(BONUS.triggerCount).reduce((sum, probability) => sum + probability, 0)
}

// Unconditional expectations per reel board. Boards below the trigger contribute nothing.
export function holdBoardMoments(cells: number, baseOrbChance: number) {
  const endings = Array.from({ length: cells + 1 }, (_, held) =>
    Array.from({ length: BONUS.respins + 1 }, () => ({ full: Number(held === cells), orbs: held })))
  for (let held = cells - 1; held >= BONUS.triggerCount; held--) {
    const hits = binomial(cells - held, BONUS.landingChance)
    const additional = hits.slice(1).reduce((sum, probability, index) => {
      const next = endings[held + index + 1][BONUS.respins]
      return { full: sum.full + probability * next.full, orbs: sum.orbs + probability * next.orbs }
    }, { full: 0, orbs: 0 })
    for (let remaining = 1; remaining <= BONUS.respins; remaining++) {
      const miss = endings[held][remaining - 1]
      endings[held][remaining] = { full: hits[0] * miss.full + additional.full, orbs: hits[0] * miss.orbs + additional.orbs }
    }
  }
  return binomial(cells, baseOrbChance).reduce((sum, probability, held) => {
    if (held < BONUS.triggerCount) return sum
    const ending = endings[held][BONUS.respins]
    return { full: sum.full + probability * ending.full, orbs: sum.orbs + probability * ending.orbs }
  }, { full: 0, orbs: 0 })
}

export const grandBoardChance = (cells: number, baseOrbChance: number) => holdBoardMoments(cells, baseOrbChance).full
