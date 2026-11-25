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

// Probability that the underlying board fills from one independently drawn reel grid.
export function grandBoardChance(cells: number, baseOrbChance: number) {
  const full = Array.from({ length: cells + 1 }, () => [0])
  full[cells] = Array<number>(BONUS.respins + 1).fill(1)
  for (let held = cells - 1; held >= BONUS.triggerCount; held--) {
    const hits = binomial(cells - held, BONUS.landingChance)
    const additional = hits.slice(1).reduce((sum, probability, index) =>
      sum + probability * full[held + index + 1][BONUS.respins], 0)
    for (let remaining = 1; remaining <= BONUS.respins; remaining++) {
      full[held][remaining] = hits[0] * full[held][remaining - 1] + additional
    }
  }
  return binomial(cells, baseOrbChance).reduce((sum, probability, held) =>
    held < BONUS.triggerCount ? sum : sum + probability * full[held][BONUS.respins], 0)
}
