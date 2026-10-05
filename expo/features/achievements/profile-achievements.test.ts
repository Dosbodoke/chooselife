import { getProfileAchievements } from './profile-achievements';

const noStats = { total_distance_walked: 0, total_full_lines: 0 };

describe('getProfileAchievements', () => {
  it('returns every achievement locked for a new profile', () => {
    const achievements = getProfileAchievements({
      isSlacMember: false,
      stats: noStats,
    });

    expect(achievements.map((a) => a.id)).toEqual([
      'slac-member',
      'first-walk',
      'first-full-line',
      'one-km-walked',
    ]);
    expect(achievements.every((a) => !a.earned)).toBe(true);
  });

  it('unlocks the SLAC badge for members', () => {
    const [first] = getProfileAchievements({
      isSlacMember: true,
      stats: noStats,
    });

    expect(first).toMatchObject({ id: 'slac-member', earned: true });
  });

  it('unlocks walk-based achievements from stats', () => {
    const earned = getProfileAchievements({
      isSlacMember: false,
      stats: { total_distance_walked: 1000, total_full_lines: 1 },
    })
      .filter((a) => a.earned)
      .map((a) => a.id);

    expect(earned).toEqual(['first-walk', 'first-full-line', 'one-km-walked']);
  });

  it('does not count 999m as one kilometer', () => {
    const oneKm = getProfileAchievements({
      isSlacMember: false,
      stats: { total_distance_walked: 999, total_full_lines: 0 },
    }).find((a) => a.id === 'one-km-walked');

    expect(oneKm?.earned).toBe(false);
  });

  it('lists earned achievements before locked ones', () => {
    const achievements = getProfileAchievements({
      isSlacMember: false,
      stats: { total_distance_walked: 0, total_full_lines: 2 },
    });

    expect(achievements[0]).toMatchObject({
      id: 'first-full-line',
      earned: true,
    });
    expect(achievements.slice(1).every((a) => !a.earned)).toBe(true);
  });
});
