import { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Badge {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  iconUrl: string | null;
  criteria: string;
  createdAt: string;
}

interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  badge: Badge;
}

type ChallengeStatus = 'upcoming' | 'active' | 'completed';
type GoalType = 'books_read' | 'pages_read' | 'challenges_completed';

interface Challenge {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  goal: number;
  goalType: GoalType;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  createdAt: string;
}

interface Enrollment {
  id: string;
  challengeId: string;
  userId: string;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  challenge: Challenge;
}

interface LeaderboardEntry {
  fullName: string;
  progress: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CRITERIA_EMOJI: Record<string, string> = {
  books_read_1: '📖',
  books_read_5: '📚',
  books_read_10: '🏆',
  books_read_25: '⭐',
  club_joined: '🤝',
  challenge_completed: '🎯',
  reading_list_created: '📝',
};

const CHALLENGE_STATUS_COLORS: Record<ChallengeStatus, { bg: string; text: string; border: string }> = {
  upcoming: { bg: 'rgba(245,158,11,0.2)', text: '#fcd34d', border: 'rgba(245,158,11,0.4)' },
  active: { bg: 'rgba(34,197,94,0.2)', text: '#86efac', border: 'rgba(34,197,94,0.4)' },
  completed: { bg: 'rgba(99,102,241,0.2)', text: '#a5b4fc', border: 'rgba(99,102,241,0.4)' },
};

const CHALLENGE_STATUS_LABELS: Record<ChallengeStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Completed',
};

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  books_read: 'books',
  pages_read: 'pages',
  challenges_completed: 'challenges',
};

const CHALLENGE_FILTERS = ['all', 'active', 'upcoming', 'completed'] as const;
type ChallengeFilter = (typeof CHALLENGE_FILTERS)[number];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

/** Skeleton card for loading state. */
function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, marginBottom: 8 }}
    >
      <div style={{ height: 12, background: 'rgba(255,255,255,0.15)', borderRadius: 4, width: '55%', marginBottom: 8 }} />
      <div style={{ height: 9, background: 'rgba(255,255,255,0.08)', borderRadius: 4, width: '80%' }} />
    </div>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

/** Resolves the display emoji for a badge. */
function getBadgeEmoji(badge: Badge): string {
  if (badge.iconUrl) return '';
  return CRITERIA_EMOJI[badge.criteria] ?? '🏅';
}

/** Formats the criteria key into a human hint (e.g. "books_read_5" → "Read 5 books"). */
function criteriaHint(criteria: string): string {
  const map: Record<string, string> = {
    books_read_1: 'Read 1 book',
    books_read_5: 'Read 5 books',
    books_read_10: 'Read 10 books',
    books_read_25: 'Read 25 books',
    club_joined: 'Join a book club',
    challenge_completed: 'Complete a challenge',
    reading_list_created: 'Create a reading list',
  };
  return map[criteria] ?? criteria.replace(/_/g, ' ');
}

// ─── BadgeCard ────────────────────────────────────────────────────────────────

/** Single badge card, earned or locked. */
function BadgeCard({ badge, earned, earnedAt }: { badge: Badge; earned: boolean; earnedAt?: string }) {
  const emoji = getBadgeEmoji(badge);
  return (
    <div
      style={{
        background: earned ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        opacity: earned ? 1 : 0.55,
        filter: earned ? 'none' : 'grayscale(100%)',
      }}
    >
      {badge.iconUrl ? (
        <img
          src={badge.iconUrl}
          alt={badge.name}
          style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4 }}
        />
      ) : (
        <span style={{ fontSize: 32 }}>{emoji}</span>
      )}
      <span style={{ color: 'white', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>{badge.name}</span>
      {earned && earnedAt ? (
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, textAlign: 'center' }}>
          Earned {new Date(earnedAt).toLocaleDateString()}
        </span>
      ) : (
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center' }}>
          {criteriaHint(badge.criteria)}
        </span>
      )}
    </div>
  );
}

// ─── BadgesTab ────────────────────────────────────────────────────────────────

/** Badges tab: earned section + locked section. */
function BadgesTab() {
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => { void fetchData(); }, []);

  /** Fetches all school badges and the student's earned badges in parallel. */
  async function fetchData() {
    setLoading(true);
    try {
      const [all, mine] = await Promise.all([
        api.get<Badge[]>('/badges'),
        api.get<UserBadge[]>('/badges/me'),
      ]);
      setAllBadges(all);
      setUserBadges(mine);
    } catch {
      showToast('Failed to load badges.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const earnedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub]));
  const earnedBadges = userBadges;
  const unearned = allBadges.filter((b) => !earnedMap.has(b.id));

  if (loading) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </>
    );
  }

  if (allBadges.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.6)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏅</div>
        <p style={{ margin: 0 }}>No badges defined for your school yet.</p>
      </div>
    );
  }

  return (
    <>
      {earnedBadges.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>My Badges ({earnedBadges.length})</div>
          <div style={badgeGridStyle}>
            {earnedBadges.map((ub) => (
              <BadgeCard key={ub.id} badge={ub.badge} earned earnedAt={ub.earnedAt} />
            ))}
          </div>
        </>
      )}

      {unearned.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>Locked</div>
          <div style={badgeGridStyle}>
            {unearned.map((b) => (
              <BadgeCard key={b.id} badge={b} earned={false} />
            ))}
          </div>
        </>
      )}

      {earnedBadges.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px 0', color: 'rgba(255,255,255,0.6)' }}>
          <p style={{ margin: 0, fontSize: 13 }}>Complete activities to earn your first badge!</p>
        </div>
      )}

      {toast && <Toast msg={toast} />}
    </>
  );
}

// ─── Leaderboard panel ────────────────────────────────────────────────────────

/** Inline leaderboard panel showing top 5 entries. */
function LeaderboardPanel({
  challengeId,
  currentUserId,
  goalType,
  onClose,
}: {
  challengeId: string;
  currentUserId: string | undefined;
  goalType: GoalType;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const myName = user ? user.name ?? '' : '';

  useEffect(() => { void fetchLeaderboard(); }, [challengeId]);

  /** Fetches leaderboard data for the given challenge. */
  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const data = await api.get<LeaderboardEntry[]>(`/challenges/${challengeId}/leaderboard`);
      setEntries(data.slice(0, 5));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  const unit = GOAL_TYPE_LABELS[goalType];

  return (
    <div
      style={{
        marginTop: 10,
        background: 'rgba(30,20,80,0.95)',
        borderRadius: 8,
        padding: 12,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>Leaderboard</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>No entries yet.</div>
      ) : (
        entries.map((entry, idx) => {
          const isMe = entry.fullName === myName;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 6,
                marginBottom: 4,
                background: isMe ? 'rgba(99,102,241,0.25)' : 'transparent',
                border: isMe ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, width: 18, textAlign: 'center' }}>
                {idx + 1}
              </span>
              <span style={{ flex: 1, color: isMe ? '#a5b4fc' : 'white', fontSize: 12, fontWeight: isMe ? 700 : 400 }}>
                {entry.fullName}
                {isMe && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 6 }}>(you)</span>}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {entry.progress} {unit}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── ChallengeCard ────────────────────────────────────────────────────────────

/** Single challenge card with enroll + leaderboard actions. */
function ChallengeCard({
  challenge,
  enrollment,
  onEnroll,
}: {
  challenge: Challenge;
  enrollment: Enrollment | undefined;
  onEnroll: (id: string) => Promise<void>;
}) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isEnrolled = enrollment !== undefined;
  const canEnroll = !isEnrolled && (challenge.status === 'active' || challenge.status === 'upcoming');
  const sc = CHALLENGE_STATUS_COLORS[challenge.status];
  const unit = GOAL_TYPE_LABELS[challenge.goalType];
  const progress = enrollment?.progress ?? 0;
  const progressPct = Math.min(100, Math.round((progress / challenge.goal) * 100));

  return (
    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{challenge.title}</div>
          {challenge.description && (
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 6 }}>{challenge.description}</div>
          )}
        </div>
        <span
          style={{
            background: sc.bg,
            color: sc.text,
            border: `1px solid ${sc.border}`,
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {CHALLENGE_STATUS_LABELS[challenge.status]}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
          Goal: {challenge.goal} {unit}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          {new Date(challenge.startDate).toLocaleDateString()} – {new Date(challenge.endDate).toLocaleDateString()}
        </span>
      </div>

      {/* Progress bar (enrolled) */}
      {isEnrolled && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
              {progress}/{challenge.goal} {unit}
            </span>
            {enrollment.completed && (
              <span style={{ color: '#86efac', fontSize: 11, fontWeight: 700 }}>Completed</span>
            )}
          </div>
          {/* Track */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: enrollment.completed ? '#86efac' : '#6366f1',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {canEnroll && (
          <button
            onClick={() => void onEnroll(challenge.id)}
            style={{
              background: 'white',
              color: '#4f46e5',
              border: 'none',
              borderRadius: 7,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Enroll
          </button>
        )}
        <button
          onClick={() => setShowLeaderboard((v) => !v)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)',
            borderRadius: 7,
            padding: '5px 14px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {showLeaderboard ? 'Hide Leaderboard' : 'View Leaderboard'}
        </button>
      </div>

      {showLeaderboard && (
        <LeaderboardPanel
          challengeId={challenge.id}
          currentUserId={user?.id}
          goalType={challenge.goalType}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  );
}

// ─── ChallengesTab ────────────────────────────────────────────────────────────

/** Challenges tab: filter chips + cards. */
function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ChallengeFilter>('all');
  const [toast, setToast] = useState('');

  useEffect(() => { void fetchData(); }, []);

  /** Fetches all challenges and the student's enrollments in parallel. */
  async function fetchData() {
    setLoading(true);
    try {
      const [all, mine] = await Promise.all([
        api.get<Challenge[]>('/challenges'),
        api.get<Enrollment[]>('/challenges/me'),
      ]);
      setChallenges(all);
      setEnrollments(mine);
    } catch {
      showToast('Failed to load challenges.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  /** Enrolls the student in a challenge. */
  async function handleEnroll(id: string) {
    try {
      await api.post(`/challenges/${id}/enroll`, {});
      const challenge = challenges.find((c) => c.id === id);
      if (challenge) {
        const newEnrollment: Enrollment = {
          id: crypto.randomUUID(),
          challengeId: id,
          userId: '',
          progress: 0,
          completed: false,
          completedAt: null,
          challenge,
        };
        setEnrollments((prev) => [...prev, newEnrollment]);
      }
      showToast('Enrolled in challenge!');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to enroll.');
    }
  }

  const enrollmentMap = new Map(enrollments.map((e) => [e.challengeId, e]));

  const displayed = filter === 'all'
    ? challenges
    : challenges.filter((c) => c.status === filter);

  const emptyMessages: Record<ChallengeFilter, string> = {
    all: 'No challenges available.',
    active: 'No active challenges right now.',
    upcoming: 'No upcoming challenges.',
    completed: 'No completed challenges.',
  };

  if (loading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </>
    );
  }

  return (
    <>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {CHALLENGE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'white' : 'rgba(255,255,255,0.1)',
              color: filter === f ? '#4f46e5' : 'rgba(255,255,255,0.7)',
              border: 'none',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {f === 'all' ? 'All' : CHALLENGE_STATUS_LABELS[f as ChallengeStatus]}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <p style={{ margin: 0 }}>{emptyMessages[filter]}</p>
        </div>
      ) : (
        displayed.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            enrollment={enrollmentMap.get(c.id)}
            onEnroll={handleEnroll}
          />
        ))
      )}

      {toast && <Toast msg={toast} />}
    </>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16,
      background: 'rgba(0,0,0,0.85)', color: 'white',
      borderRadius: 10, padding: '12px 16px', fontSize: 13, textAlign: 'center',
      zIndex: 200,
    }}>
      {msg}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const sectionHeaderStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 10,
  marginTop: 4,
};

const badgeGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  marginBottom: 16,
};

// ─── AchievementsPage ─────────────────────────────────────────────────────────

type Tab = 'badges' | 'challenges';

/** Achievements page — Badges and Challenges tabs for the student portal. */
export function AchievementsPage() {
  const [tab, setTab] = useState<Tab>('badges');

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {/* Header */}
      <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '0 0 14px' }}>Achievements</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['badges', 'challenges'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? 'white' : 'rgba(255,255,255,0.1)',
              color: tab === t ? '#4f46e5' : 'rgba(255,255,255,0.7)',
              border: 'none',
              borderRadius: 20,
              padding: '5px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t === 'badges' ? 'Badges' : 'Challenges'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'badges' ? <BadgesTab /> : <ChallengesTab />}
    </div>
  );
}
