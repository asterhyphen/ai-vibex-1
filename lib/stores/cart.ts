'use client'

import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export interface CartItem {
  menuItemId: string
  name: string
  price_paise: number
  qty: number
  prep_seconds: number
}

export interface FlyoutEvent {
  id: number
  x: number
  y: number
  label: string
}

export type AddCartItemInput = Omit<CartItem, 'qty'> & { qty?: number }

export interface CartStore {
  items: CartItem[]
  total_paise: number
  total_items: number
  hasHydrated: boolean
  lastAddedAt: number
  flyoutEvent: FlyoutEvent | null
  addItem: (item: AddCartItemInput, origin?: { x: number; y: number }) => void
  removeItem: (menuItemId: string) => void
  updateQty: (menuItemId: string, qty: number) => void
  clearCart: () => void
  clearFlyout: () => void
  setHasHydrated: (hydrated: boolean) => void
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

function computeTotals(items: CartItem[]): { total_paise: number; total_items: number } {
  let total_paise = 0
  let total_items = 0
  for (const item of items) {
    total_paise += item.price_paise * item.qty
    total_items += item.qty
  }
  return { total_paise, total_items }
}

let flyoutCounter = 0

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total_paise: 0,
      total_items: 0,
      hasHydrated: false,
      lastAddedAt: 0,
      flyoutEvent: null,

      addItem: (input, origin) => {
        const addQty = Math.max(1, Math.floor(input.qty ?? 1))
        const current = get().items
        const existingIndex = current.findIndex((i) => i.menuItemId === input.menuItemId)

        let nextItems: CartItem[]
        if (existingIndex >= 0) {
          nextItems = current.map((item, idx) =>
            idx === existingIndex
              ? {
                  ...item,
                  name: input.name,
                  price_paise: input.price_paise,
                  prep_seconds: input.prep_seconds,
                  qty: Math.min(50, item.qty + addQty),
                }
              : item
          )
        } else {
          nextItems = [
            ...current,
            {
              menuItemId: input.menuItemId,
              name: input.name,
              price_paise: input.price_paise,
              prep_seconds: input.prep_seconds,
              qty: Math.min(50, addQty),
            },
          ]
        }

        const totals = computeTotals(nextItems)
        const now = Date.now()
        flyoutCounter += 1

        set({
          items: nextItems,
          ...totals,
          lastAddedAt: now,
          flyoutEvent: origin
            ? {
                id: flyoutCounter,
                x: origin.x,
                y: origin.y,
                label: input.name,
              }
            : get().flyoutEvent,
        })
      },

      removeItem: (menuItemId) => {
        const nextItems = get().items.filter((item) => item.menuItemId !== menuItemId)
        set({
          items: nextItems,
          ...computeTotals(nextItems),
        })
      },

      updateQty: (menuItemId, qty) => {
        const cleanQty = Math.floor(qty)
        if (cleanQty <= 0) {
          get().removeItem(menuItemId)
          return
        }
        const cappedQty = Math.min(50, cleanQty)
        const nextItems = get().items.map((item) =>
          item.menuItemId === menuItemId ? { ...item, qty: cappedQty } : item
        )
        set({
          items: nextItems,
          ...computeTotals(nextItems),
        })
      },

      clearCart: () => {
        set({
          items: [],
          total_paise: 0,
          total_items: 0,
          flyoutEvent: null,
        })
      },

      clearFlyout: () => {
        set({ flyoutEvent: null })
      },

      setHasHydrated: (hydrated) => {
        set({ hasHydrated: hydrated })
      },
    }),
    {
      name: 'mite-canteen-cart',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : noopStorage
      ),
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const totals = computeTotals(state.items ?? [])
          state.total_paise = totals.total_paise
          state.total_items = totals.total_items
          state.hasHydrated = true
        }
      },
    }
  )
)
