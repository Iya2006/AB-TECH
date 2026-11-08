import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Fusion de classes Tailwind, à la convention shadcn (`@/lib/utils`) : utilisée par les composants de components/ui. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
