/**
 * Formats user's full name from separate fields
 */
export function formatFullName(
  lastName: string,
  firstName: string,
  middleName?: string | null
): string {
  const parts = [lastName, firstName, middleName].filter(Boolean);
  return parts.join(' ');
}

/**
 * Formats user's short name (LastName F. M.)
 */
export function formatShortName(
  lastName: string,
  firstName: string,
  middleName?: string | null
): string {
  const firstInitial = firstName.charAt(0).toUpperCase() + '.';
  const middleInitial = middleName ? middleName.charAt(0).toUpperCase() + '.' : '';
  
  return `${lastName} ${firstInitial}${middleInitial ? ' ' + middleInitial : ''}`;
}
