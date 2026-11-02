import type { UserRole } from '../types'

/** Page d'accueil de chaque rôle (connexion, redirections, « Voir comme »). */
export const ROLE_HOME: Record<UserRole, string> = {
  owner: '/owner', super_admin: '/admin', cooperative: '/coop', agent: '/agent', usine: '/usine',
}

export const homeFor = (role?: string | null) => ROLE_HOME[(role ?? 'agent') as UserRole] ?? '/'
