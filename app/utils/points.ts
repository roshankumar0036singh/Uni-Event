export type UserTitle = {
  title: string;
  minPoints: number;
  color: string;
};

export const TITLE_TIERS: UserTitle[] = [
  { title: 'Novice',        minPoints: 0,    color: '#9E9E9E' },
  { title: 'Bronze Scout',  minPoints: 100,  color: '#CD7F32' },
  { title: 'Silver Seeker', minPoints: 300,  color: '#C0C0C0' },
  { title: 'Gold Achiever', minPoints: 600,  color: '#FFD700' },
  { title: 'Platinum Star', minPoints: 1000, color: '#E5E4E2' },
  { title: 'Campus Legend', minPoints: 2000, color: '#FF6B35' },
];

export function getUserTitle(points: number): UserTitle {
  for (let i = TITLE_TIERS.length - 1; i >= 0; i--) {
    if (points >= TITLE_TIERS[i].minPoints) {
      return TITLE_TIERS[i];
    }
  }
  return TITLE_TIERS[0];
}

export function getPointsToNextTitle(points: number): number | null {
  for (let i = 0; i < TITLE_TIERS.length; i++) {
    if (points < TITLE_TIERS[i].minPoints) {
      return TITLE_TIERS[i].minPoints - points;
    }
  }
  return null;
}