export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  ratingGamesPlayed: number;
};

export type AuthMeResponse = {
  user: AuthUser | null;
};

export type RatingChange = {
  before: number;
  after: number;
  delta: number;
};
