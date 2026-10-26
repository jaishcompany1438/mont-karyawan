export const TASK_MANAGEMENT_ROLES = ['SUPER_ADMIN', 'MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID'];

const LEADERSHIP_ROLES = ['MUDIR', 'WAKIL_MUDIR', 'WADIR_PEND', 'WADIR_PENGS', 'KABID'];
export const DEFAULT_TAB = 'dashboard';

const TAB_RULES = {
  dashboard: () => true,
  reports: () => true,
  tasks: (user) => TASK_MANAGEMENT_ROLES.includes(user?.role),
  patrol: (user) => user?.role === 'SUPER_ADMIN' || Boolean(user?.can_patroli) || LEADERSHIP_ROLES.includes(user?.role),
  'cross-requests': (user) => Boolean(user?.role) && user.role !== 'STAF',
  departments: (user) => ['SUPER_ADMIN', 'MUDIR'].includes(user?.role),
  users: (user) => ['SUPER_ADMIN', 'MUDIR'].includes(user?.role),
};

export function canAccessTab(tab, user) {
  const rule = TAB_RULES[tab];
  return Boolean(rule && user && rule(user));
}

export function isKnownTab(tab) {
  return Object.prototype.hasOwnProperty.call(TAB_RULES, tab);
}

export function getTabFromHash(hash = '') {
  return String(hash).replace(/^#\/?/, '').split(/[/?]/)[0] || DEFAULT_TAB;
}

// Mengembalikan tab yang diminta jika boleh diakses; selain itu kembali ke dashboard.
export function resolveAccessibleTab(tab, user) {
  return canAccessTab(tab, user) ? tab : DEFAULT_TAB;
}
