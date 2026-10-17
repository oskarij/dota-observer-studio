// A saved team, referenced by known players (teamId) and the series state.
export interface Team {
  id: string;
  name: string;
  tag: string;
  // Root-relative URL under the hosts' /media/ route (e.g. /media/team-logos/<file>), or null.
  logoPath: string | null;
  // Valve team id from league GSI data, so live league games can be matched to this team.
  externalTeamId: number | null;
}
