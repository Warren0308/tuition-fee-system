/**
 * 获取课程的标准名称
 */
export function getStandardCourseName(name: string): string {
  // 移除前缀
  if (name.startsWith('补习班-')) {
    return name.replace('补习班-', '');
  }
  if (name.startsWith('中学')) {
    return name.replace('中学', '');
  }
  return name;
}

/**
 * 获取课程组的类型
 */
export function getCourseGroupType(group: string): string {
  switch (group) {
    case 'TUITION':
      return '小学课程';
    case 'SEC_ENGLISH':
    case 'SEC_MALAY':
    case 'SEC_MATH':
    case 'SEC_HISTORY':
    case 'SEC_EN_WRITING':
      return '中学课程';
    case 'HOMEWORK':
    case 'WRITING':
      return '独立课程';
    default:
      return '其他';
  }
}

/**
 * 检查两个课程名称是否匹配
 */
export function isCourseNameMatch(courseName: string, dictCourseName: string, courseGroup?: string, dictType?: string): boolean {
  const standardCourseName = getStandardCourseName(courseName);
  const standardDictName = getStandardCourseName(dictCourseName);
  
  // 如果提供了课程组和字典类型，需要同时匹配
  if (courseGroup && dictType) {
    const courseType = getCourseGroupType(courseGroup);
    return standardCourseName === standardDictName && courseType === dictType;
  }
  
  // 否则只匹配名称
  return standardCourseName === standardDictName;
}

/**
 * 获取课程类型的显示名称
 */
export function getCourseTypeName(courseGroup: string): string {
  return getCourseGroupType(courseGroup);
}

/**
 * 获取课程的显示名称
 */
export function getCourseDisplayName(name: string): string {
  return getStandardCourseName(name);
}

/**
 * 检查课程是否已存在于费用列表中
 */
export function isCourseExistInFees(
  dictCourse: { id: number; name: string; type: { name: string } }, 
  fees: Array<{ course: { name: string; group: string } }>
): boolean {
  return fees.some(fee => {
    // 通过名称和类型匹配
    const nameMatch = isCourseNameMatch(
      fee.course.name, 
      dictCourse.name,
      fee.course.group,
      dictCourse.type.name
    );
    return nameMatch;
  });
}