/** 角色权限判断（页面 / API / middleware 共用） */

export function isAdminUser(roles: string[]): boolean {
  return roles.includes("ADMIN");
}

export function isRecipientUser(roles: string[]): boolean {
  return roles.includes("RECIPIENT");
}

/** 纯老师账号：有 TEACHER 且无 ADMIN/RECIPIENT */
export function isTeacherOnly(roles: string[]): boolean {
  return (
    roles.includes("TEACHER") &&
    !roles.includes("ADMIN") &&
    !roles.includes("RECIPIENT")
  );
}

/** 统计分析、报表、缴费台账等财务数据 */
export function canAccessStats(roles: string[]): boolean {
  return isAdminUser(roles) || isRecipientUser(roles);
}

export function canAccessBilling(roles: string[]): boolean {
  return canAccessStats(roles);
}
