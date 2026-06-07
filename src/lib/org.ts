import { supabase } from './supabase'
import type { OrgRole } from './featureAccess'

export const DUMPERS_ORG_SLUG = 'dumpers'

export interface Organization {
  id: string
  name: string
  slug: string
  resources_public?: boolean
  joinable?: boolean
}

export interface JoinableOrganization {
  id: string
  name: string
  slug: string
  resources_public: boolean
}

export interface OrgMembership {
  org_id: string
  user_id: string
  org_role: OrgRole
  verified_at: string | null
  verified_by: string | null
  joined_at: string
}

export function isDumpersOrg(org: Pick<Organization, 'slug'> | null | undefined): boolean {
  return org?.slug === DUMPERS_ORG_SLUG
}

export async function searchJoinableOrganizations(
  query = ''
): Promise<{ data: JoinableOrganization[]; error?: string }> {
  const { data, error } = await supabase.rpc('search_joinable_organizations', {
    p_query: query,
  })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as JoinableOrganization[] }
}

export async function joinOrganization(orgId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('join_organization', { p_org_id: orgId })
  if (error) return { error: error.message }
  return {}
}

export async function joinDumpersOrganization(): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('join_dumpers_organization')
  if (error) return { error: error.message }
  return {}
}

/** Ensures the signed-in user is in verified Dumpers org (signup backfill / legacy accounts). */
export async function ensureDumpersMembership(): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('ensure_dumpers_membership')
  if (error) return { error: error.message }
  return {}
}

export async function setOrgResourcesPublic(isPublic: boolean): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('set_org_resources_public', { p_public: isPublic })
  if (error) return { error: error.message }
  return {}
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, resources_public, joinable')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching organization:', error)
    return null
  }

  return data as Organization | null
}

export async function fetchOrgMembership(
  userId: string,
  orgId: string
): Promise<OrgMembership | null> {
  const { data, error } = await supabase
    .from('org_memberships')
    .select('org_id, user_id, org_role, verified_at, verified_by, joined_at')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching org membership:', error)
    return null
  }

  return data as OrgMembership | null
}

export async function fetchOrgMembershipsForUsers(
  userIds: string[],
  orgId: string
): Promise<Record<string, OrgMembership>> {
  if (userIds.length === 0) return {}

  const { data, error } = await supabase
    .from('org_memberships')
    .select('org_id, user_id, org_role, verified_at, verified_by, joined_at')
    .eq('org_id', orgId)
    .in('user_id', userIds)

  if (error) {
    console.error('Error fetching org memberships:', error)
    return {}
  }

  const map: Record<string, OrgMembership> = {}
  for (const row of data ?? []) {
    map[row.user_id] = row as OrgMembership
  }
  return map
}

export async function ensureDefaultOrgMembership(
  userId: string
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('ensure_default_org_membership', {
    p_user_id: userId,
  })

  if (error) return { error: error.message }
  return {}
}

export async function verifyOrgMember(userId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('verify_org_member', { p_user_id: userId })
  if (error) return { error: error.message }
  return {}
}

export async function revokeOrgVerification(userId: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('revoke_org_verification', { p_user_id: userId })
  if (error) return { error: error.message }
  return {}
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  officer: 'Officer',
  member: 'Member',
}

export const MEMBER_SCOPE_STORAGE_KEY = 'dumpers_member_scope'

export type MemberScope = 'all' | 'org'

export function readMemberScope(defaultScope: MemberScope = 'all'): MemberScope {
  if (typeof window === 'undefined') return defaultScope
  const stored = window.localStorage.getItem(MEMBER_SCOPE_STORAGE_KEY)
  return stored === 'org' ? 'org' : stored === 'all' ? 'all' : defaultScope
}

export function writeMemberScope(scope: MemberScope): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MEMBER_SCOPE_STORAGE_KEY, scope)
}
