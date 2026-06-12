export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  PR: {
    ROOT: '/pr',
    CREATE: '/pr/create',
    STATUS: '/pr/status',
    HISTORY: '/pr/history',
    DETAIL: '/pr/:id',
  },
  PO: {
    ROOT: '/po',
    CREATE: '/po/create',
    STATUS: '/po/status',
    HISTORY: '/po/history',
    DETAIL: '/po/:id',
  },
  MASTER: {
    ROOT: '/master',
    GROUPS: '/master/groups',
    MATERIALS: '/master/materials',
    LOCATION: '/master/location',
    SUPPLIER: '/master/supplier',
  },
  SYSTEM: {
    ROOT: '/system',
    CONFIG: '/system/config',
    USERS: '/system/users',
    ROLES: '/system/roles',
    MENUS: '/system/menus',
    PERMISSIONS: '/system/permissions',
  },
} as const
