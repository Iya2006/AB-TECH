import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartLine {
  productId: string
  qty: number
}

interface CartState {
  lines: CartLine[]
  add: (productId: string, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
}

/** Panier mémorisé dans le navigateur du visiteur (rien n'est envoyé avant la commande). */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (productId, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.productId === productId)
          return {
            lines: existing
              ? s.lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(999, l.qty + qty) } : l))
              : [...s.lines, { productId, qty }],
          }
        }),
      setQty: (productId, qty) =>
        set((s) => ({ lines: s.lines.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, Math.min(999, qty)) } : l)) })),
      remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'abtech-panier' },
  ),
)
