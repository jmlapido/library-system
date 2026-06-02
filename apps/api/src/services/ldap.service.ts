import ldap from 'ldapjs';
import { AppError } from '../utils/errors.js';

export interface LdapConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  /** LDAP search filter with {{email}} placeholder, e.g. "(mail={{email}})" */
  searchFilter: string;
  emailAttribute: string;
  nameAttribute: string;
}

/** Escape special LDAP filter characters per RFC 4515. */
function escapeFilter(value: string): string {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

function createLdapClient(url: string): Promise<ldap.Client> {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url, timeout: 5000, connectTimeout: 5000 });
    client.on('connect', () => resolve(client));
    client.on('error', (err: Error) => reject(err));
  });
}

function bindLdapClient(client: ldap.Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function searchLdapUser(
  client: ldap.Client,
  baseDn: string,
  filter: string,
  attributes: string[],
): Promise<{ dn: string; attrs: Record<string, string> } | null> {
  return new Promise((resolve, reject) => {
    let found: { dn: string; attrs: Record<string, string> } | null = null;

    client.search(baseDn, { filter, scope: 'sub', attributes }, (err, res) => {
      if (err) { reject(err); return; }

      res.on('searchEntry', (entry) => {
        const attrs: Record<string, string> = {};
        for (const attr of entry.attributes) {
          attrs[attr.type] = Array.isArray(attr.values) ? (attr.values[0] ?? '') : String(attr.values);
        }
        found = { dn: entry.objectName, attrs };
      });
      res.on('error', (e: Error) => reject(e));
      res.on('end', () => resolve(found));
    });
  });
}

function unbindLdapClient(client: ldap.Client): Promise<void> {
  return new Promise((resolve) => {
    client.unbind(() => resolve());
  });
}

/**
 * Verify credentials against an LDAP/AD server.
 * Returns the user's email and display name from LDAP attributes on success.
 * @throws AppError LDAP_AUTH_FAILED on invalid credentials
 * @throws AppError LDAP_UNAVAILABLE on connection/search errors
 */
export async function verifyLdapCredentials(
  email: string,
  password: string,
  config: LdapConfig,
): Promise<{ email: string; fullName: string }> {
  let client: ldap.Client | null = null;

  try {
    client = await createLdapClient(config.url);
    await bindLdapClient(client, config.bindDn, config.bindPassword);

    const filter = config.searchFilter.replace('{{email}}', escapeFilter(email));
    const entry = await searchLdapUser(client, config.baseDn, filter, [
      config.emailAttribute,
      config.nameAttribute,
    ]);

    if (!entry) throw new AppError('LDAP_AUTH_FAILED', 'Invalid LDAP credentials');

    try {
      await bindLdapClient(client, entry.dn, password);
    } catch {
      throw new AppError('LDAP_AUTH_FAILED', 'Invalid LDAP credentials');
    }

    return {
      email: entry.attrs[config.emailAttribute] ?? email,
      fullName: entry.attrs[config.nameAttribute] ?? email,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('LDAP_UNAVAILABLE', `LDAP server unavailable: ${(err as Error).message}`);
  } finally {
    if (client) await unbindLdapClient(client);
  }
}

/**
 * Test-bind to the LDAP server with the service account credentials.
 * @throws AppError LDAP_UNAVAILABLE on failure
 */
export async function testLdapConnection(config: LdapConfig): Promise<void> {
  let client: ldap.Client | null = null;
  try {
    client = await createLdapClient(config.url);
    await bindLdapClient(client, config.bindDn, config.bindPassword);
  } catch (err) {
    throw new AppError('LDAP_UNAVAILABLE', `LDAP test failed: ${(err as Error).message}`);
  } finally {
    if (client) await unbindLdapClient(client);
  }
}
