import type { MealDataSource } from './MealDataSource'
import { HttpDataSource } from './HttpDataSource'
import { MockDataSource } from './mock/MockDataSource'

// The ONLY place that decides between real and mock data. Driven purely by the
// `?mock` query parameter. Everything downstream receives a MealDataSource and
// is oblivious to which implementation it got.
export function isMockMode(): boolean {
  return new URLSearchParams(window.location.search).has('mock')
}

export function createDataSource(): MealDataSource {
  return isMockMode() ? new MockDataSource() : new HttpDataSource()
}
