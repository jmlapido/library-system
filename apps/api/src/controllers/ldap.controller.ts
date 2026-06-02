import type { Context } from 'hono';
import { testLdapConnection, type LdapConfig } from '../services/ldap.service.js';
import { getSchoolSettings } from '../services/school.service.js';
import { AppError } from '../utils/errors.js';

/**
 * POST /auth/ldap/test-connection — verify LDAP service-account bind.
 * Requires admin role. Uses the school's current LDAP settings.
 */
export async function testLdapConnectionController(c: Context) {
  const payload = c.get('user') as { sub: string; role: string; schoolId: string };

  try {
    const { settings } = await getSchoolSettings(payload.schoolId);

    if (!settings.ldapEnabled || !settings.ldapUrl) {
      return c.json({ success: false, error: 'LDAP is not configured', code: 'LDAP_NOT_CONFIGURED' }, 400);
    }

    const config: LdapConfig = {
      url: settings.ldapUrl,
      baseDn: settings.ldapBaseDn,
      bindDn: settings.ldapBindDn,
      bindPassword: settings.ldapBindPassword,
      searchFilter: settings.ldapSearchFilter,
      emailAttribute: settings.ldapEmailAttribute,
      nameAttribute: settings.ldapNameAttribute,
    };

    await testLdapConnection(config);
    return c.json({ success: true, message: 'LDAP connection successful' });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}
