export function expectedScore(own: number, opp: number): number {
  return 1 / (1 + Math.pow(10, (opp - own) / 400));
}

export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < 30 ? 32 : 16;
}

export function applyElo(own: number, oppTeamMean: number, won: boolean, k: number): number {
  return Math.round(own + k * ((won ? 1 : 0) - expectedScore(own, oppTeamMean)));
}

export function teamAverage(a: number, b: number): number {
  return Math.round((a + b) / 2);
}
