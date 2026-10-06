export type AchievementId =
  | 'slac-member'
  | 'first-walk'
  | 'first-full-line'
  | 'one-km-walked';

export type AchievementTone = 'violet' | 'emerald' | 'amber' | 'sky';

export type ProfileAchievement = {
  id: AchievementId;
  tone: AchievementTone;
  earned: boolean;
};

export type ProfileAchievementInput = {
  isSlacMember: boolean;
  stats: {
    total_distance_walked: number;
    total_full_lines: number;
  };
};

type AchievementDefinition = {
  id: AchievementId;
  tone: AchievementTone;
  isEarned: (input: ProfileAchievementInput) => boolean;
};

// Display order when nothing is earned. Add new achievements here.
const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'slac-member',
    tone: 'violet',
    isEarned: ({ isSlacMember }) => isSlacMember,
  },
  {
    id: 'first-walk',
    tone: 'emerald',
    isEarned: ({ stats }) => stats.total_distance_walked > 0,
  },
  {
    id: 'first-full-line',
    tone: 'amber',
    isEarned: ({ stats }) => stats.total_full_lines > 0,
  },
  {
    id: 'one-km-walked',
    tone: 'sky',
    isEarned: ({ stats }) => stats.total_distance_walked >= 1000,
  },
];

/** Every achievement with its earned state, earned ones first. */
export const getProfileAchievements = (
  input: ProfileAchievementInput,
): ProfileAchievement[] => {
  const achievements = ACHIEVEMENTS.map(({ id, tone, isEarned }) => ({
    id,
    tone,
    earned: isEarned(input),
  }));

  return [
    ...achievements.filter((achievement) => achievement.earned),
    ...achievements.filter((achievement) => !achievement.earned),
  ];
};
