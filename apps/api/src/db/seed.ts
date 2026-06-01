/**
 * Dev seed — creates demo logins with known credentials.
 * Run: pnpm tsx apps/api/src/db/seed.ts
 */
import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { users } from './schema/users.js';
import { schools } from './schema/schools.js';
import { eq } from 'drizzle-orm';

const SCHOOL_ID = 'fbf10178-667a-4549-bd16-a25b91731c25';

async function seed() {
  console.log('Seeding demo users...');

  const HASH_ROUNDS = 12;

  const adminHash    = await bcrypt.hash('admin1234', HASH_ROUNDS);
  const libHash      = await bcrypt.hash('lib1234', HASH_ROUNDS);
  const assistHash   = await bcrypt.hash('assist1234', HASH_ROUNDS);
  const studentPin1  = await bcrypt.hash('1234', HASH_ROUNDS);
  const studentPin2  = await bcrypt.hash('5678', HASH_ROUNDS);

  const demoUsers = [
    {
      email: 'admin@librams.dev',
      passwordHash: adminHash,
      fullName: 'Admin User',
      role: 'admin' as const,
      approvalStatus: 'approved' as const,
      emailVerified: true,
      schoolId: SCHOOL_ID,
    },
    {
      email: 'librarian@librams.dev',
      passwordHash: libHash,
      fullName: 'Jane Librarian',
      role: 'librarian' as const,
      approvalStatus: 'approved' as const,
      emailVerified: true,
      schoolId: SCHOOL_ID,
    },
    {
      email: 'assistant@librams.dev',
      passwordHash: assistHash,
      fullName: 'Carlos Assistant',
      role: 'library_assistant' as const,
      approvalStatus: 'approved' as const,
      emailVerified: true,
      schoolId: SCHOOL_ID,
    },
    {
      studentId: '2024-001',
      pinHash: studentPin1,
      fullName: 'Maria Santos',
      role: 'student' as const,
      approvalStatus: 'approved' as const,
      emailVerified: true,
      schoolId: SCHOOL_ID,
      gradeLevel: 9,
    },
    {
      studentId: '2024-002',
      pinHash: studentPin2,
      fullName: 'Juan dela Cruz',
      role: 'student' as const,
      approvalStatus: 'approved' as const,
      emailVerified: true,
      schoolId: SCHOOL_ID,
      gradeLevel: 7,
    },
  ];

  for (const u of demoUsers) {
    const identifier = u.email ?? u.studentId!;
    const existing = u.email
      ? await db.select({ id: users.id }).from(users).where(eq(users.email, u.email)).limit(1)
      : await db.select({ id: users.id }).from(users).where(eq(users.studentId, u.studentId!)).limit(1);

    const existingUser = existing[0];
    if (existingUser) {
      await db.update(users).set(u).where(eq(users.id, existingUser.id));
      console.log(`  updated: ${identifier}`);
    } else {
      await db.insert(users).values(u);
      console.log(`  created: ${identifier}`);
    }
  }

  console.log('\nDemo credentials:');
  console.log('  Admin:     admin@librams.dev      / admin1234');
  console.log('  Librarian: librarian@librams.dev  / lib1234');
  console.log('  Assistant: assistant@librams.dev  / assist1234');
  console.log('  Student 1: ID 2024-001            PIN 1234');
  console.log('  Student 2: ID 2024-002            PIN 5678');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
