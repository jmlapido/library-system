import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { testLdapConnectionController } from '../controllers/ldap.controller.js';

export const ldapRouter = new Hono();

ldapRouter.post('/ldap/test-connection', requireAuth, requireRole('admin'), testLdapConnectionController);
