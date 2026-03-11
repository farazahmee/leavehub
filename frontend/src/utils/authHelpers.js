/**
 * Auth helpers for user_type (platform_admin / tenant_user) and legacy role.
 * Backend now returns user_type and tenant_id; role is kept for backward compatibility.
 */

/**
 * True if user can access admin-only features (dashboard summary, all leave, etc.)
 * Includes: platform_admin, super_admin, team_lead, and tenant Company Admin / HR Manager / Team Lead
 */
export function isAdminUser(user) {
  if (!user) return false
  if (user.user_type === 'platform_admin') return true
  if (user.role === 'super_admin' || user.role === 'team_lead') return true
  const roles = user.tenant_roles || []
  if (roles.some((r) => ['Company Admin', 'HR Manager', 'Team Lead'].includes(r))) return true
  return false
}

/**
 * True if user can add users (admin create user) or manage teams (create/edit/delete team).
 * Includes: platform_admin, super_admin, and tenant Company Admin
 */
export function canAddUser(user) {
  if (!user) return false
  if (user.user_type === 'platform_admin') return true
  if (user.role === 'super_admin') return true
  const roles = user.tenant_roles || []
  if (roles.includes('Company Admin')) return true
  return false
}

/**
 * True if user is platform super admin (Super Admin portal access).
 * Includes both new user_type and legacy role so existing super_admin users see the section.
 */
export function isPlatformAdmin(user) {
  if (!user) return false
  if (user.user_type === 'platform_admin') return true
  if (user.role === 'super_admin') return true
  return false
}

/**
 * Human-readable role label for sidebar/profile
 */
export function getUserRoleLabel(user) {
  if (!user) return ''
  if (user.user_type === 'platform_admin') return 'Platform Admin'
  if (user.role) return user.role.replace(/_/g, ' ')
  return 'User'
}
