import type {
  AccountActivity,
  AdminStats,
  AdminUser,
  AuthSession,
  AuthStatus,
  AuthUser,
  ProfileInput,
  RegisterInput,
  UserRole,
  Order,
  OrderInput,
  OrderStatus,
  Product,
  ProductInput,
  QuoteRecord,
  QuoteRequestInput,
  QuoteStatus,
  Realisation,
  RealisationInput,
  Review,
  ReviewInput,
  ReviewStatus,
  Service,
  SiteData,
  SiteSettings,
  StationContent,
  StationSlug,
} from '@atelier/shared'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: Record<string, string[] | undefined>,
    /** auth_required · forbidden · password_change_required */
    readonly code?: string,
  ) {
    super(message)
  }
}

/** Prévenu quand le serveur refuse l'accès (session expirée, rôle insuffisant…) : l'écran se met à jour. */
export const accessEvents: { onDenied: ((status: number, code?: string) => void) | null } = { onDenied: null }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { credentials: 'same-origin', ...init })
  } catch {
    throw new ApiError('Connexion impossible. Vérifiez votre réseau.', 0)
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: ApiError['issues']; code?: string }
  if (!res.ok) {
    const first = body.issues && Object.values(body.issues).flat().find(Boolean)
    const message =
      res.status === 429
        ? 'Trop de tentatives. Réessayez dans quelques minutes.'
        : body.error === 'validation'
          ? (first ?? 'Vérifiez les champs.')
          : (body.error ?? 'Une erreur est survenue.')
    if ((res.status === 401 || res.status === 403) && body.code) accessEvents.onDenied?.(res.status, body.code)
    throw new ApiError(message, res.status, body.issues, body.code)
  }
  return body as T
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})

export type AdminReview = Review & { productName: string | null }

export const api = {
  site: () => request<SiteData>('/site'),
  services: () => request<Service[]>('/services'),
  reviews: (productId?: string) => request<Review[]>(`/reviews${productId ? `?productId=${productId}` : ''}`),
  createReview: (input: ReviewInput) => request<{ ok: true }>('/reviews', json('POST', input)),
  createOrder: (input: OrderInput) => request<{ id: string | null; total: number | null }>('/orders', json('POST', input)),
  createQuote: (input: QuoteRequestInput) => request<{ id: string | null }>('/quotes', json('POST', input)),

  upload(file: Blob, kind: 'logo' | 'mockup') {
    const form = new FormData()
    form.append('file', file, kind === 'mockup' ? 'apercu.jpg' : 'logo')
    return request<{ url: string }>(`/uploads?kind=${kind}`, { method: 'POST', body: form })
  },

  /** Connexion : une seule pour tout le site (clients et administrateur). */
  auth: {
    session: () => request<AuthSession>('/auth/session'),
    register: (input: RegisterInput) => request<{ user: AuthUser }>('/auth/register', json('POST', input)),
    login: (email: string, password: string) => request<{ user: AuthUser }>('/auth/login', json('POST', { email, password })),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    forgot: (email: string) => request<{ ok: true }>('/auth/forgot', json('POST', { email })),
    checkReset: (token: string) => request<{ valid: boolean; email?: string; admin?: boolean }>(`/auth/reset?token=${encodeURIComponent(token)}`),
    reset: (token: string, password: string) => request<{ user: AuthUser }>('/auth/reset', json('POST', { token, password })),
    /** Départ vers Google (pleine page) ; `next` : où revenir ensuite. */
    googleUrl: (next?: string) => `${BASE}/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`,
  },

  account: {
    saveProfile: (input: ProfileInput) => request<AuthUser>('/account/profile', json('PUT', input)),
    uploadAvatar(file: Blob) {
      const form = new FormData()
      form.append('file', file, 'photo')
      return request<AuthUser>('/account/avatar', { method: 'POST', body: form })
    },
    changePassword: (next: string, current?: string) => request<AuthUser>('/account/password', json('PUT', { current, next })),
    logoutOthers: () => request<{ ok: true }>('/account/logout-others', { method: 'POST' }),
    activity: () => request<AccountActivity>('/account/activity'),
  },

  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    users: () => request<AdminUser[]>('/admin/users'),
    setUserRole: (id: string, role: UserRole) => request<{ ok: true }>(`/admin/users/${id}`, json('PATCH', { role })),
    resetLink: (id: string) => request<{ url: string; expiresAt: string }>(`/admin/users/${id}/reset-link`, { method: 'POST' }),
    authStatus: () => request<AuthStatus>('/admin/auth-status'),

    quotes: () => request<QuoteRecord[]>('/admin/quotes'),
    setQuoteStatus: (id: string, status: QuoteStatus) => request(`/admin/quotes/${id}`, json('PATCH', { status })),
    orders: () => request<Order[]>('/admin/orders'),
    setOrderStatus: (id: string, status: OrderStatus) => request(`/admin/orders/${id}`, json('PATCH', { status })),
    reviews: () => request<AdminReview[]>('/admin/reviews'),
    setReviewStatus: (id: string, status: ReviewStatus) => request(`/admin/reviews/${id}`, json('PATCH', { status })),
    deleteReview: (id: string) => request(`/admin/reviews/${id}`, { method: 'DELETE' }),

    products: () => request<Product[]>('/admin/products'),
    saveProduct: (input: ProductInput, id?: string) =>
      request<Product>(id ? `/admin/products/${id}` : '/admin/products', json(id ? 'PUT' : 'POST', input)),
    deleteProduct: (id: string) => request(`/admin/products/${id}`, { method: 'DELETE' }),

    realisations: () => request<Realisation[]>('/admin/realisations'),
    saveRealisation: (input: RealisationInput, id?: string) =>
      request<Realisation>(id ? `/admin/realisations/${id}` : '/admin/realisations', json(id ? 'PUT' : 'POST', input)),
    deleteRealisation: (id: string) => request(`/admin/realisations/${id}`, { method: 'DELETE' }),

    stations: () => request<StationContent[]>('/admin/stations'),
    saveStation: (slug: StationSlug, input: Omit<StationContent, 'slug'>) => request(`/admin/stations/${slug}`, json('PUT', input)),
    settings: () => request<SiteSettings>('/admin/settings'),
    saveSettings: (input: SiteSettings) => request<SiteSettings>('/admin/settings', json('PUT', input)),

    upload(files: File[]) {
      const form = new FormData()
      files.forEach((f) => form.append('files', f, f.name))
      return request<{ urls: string[] }>('/admin/uploads', { method: 'POST', body: form })
    },
  },
}
