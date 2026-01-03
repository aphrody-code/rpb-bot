import { fetch } from "undici";

/**
 * Challonge API v2.1 Client
 * Documentation: https://challonge.apidog.io/
 */

const API_BASE = "https://api.challonge.com/v2.1";

interface ChallongeConfig {
  apiKey: string;
  authType: "v1" | "v2";
}

interface Tournament {
  id: string;
  type: string;
  attributes: {
    name: string;
    url: string;
    state: string;
    tournamentType: string;
    participantsCount: number;
    startAt: string | null;
    completedAt: string | null;
    description: string | null;
    gameName: string | null;
  };
}

interface Participant {
  id: string;
  type: string;
  attributes: {
    name: string;
    seed: number;
    active: boolean;
    checkedIn: boolean;
    groupPlayerIds: string[];
    misc?: string; // Custom data (Discord ID)
  };
}

interface Match {
  id: string;
  type: string;
  attributes: {
    round: number;
    state: string;
    player1Id: string | null;
    player2Id: string | null;
    winnerId: string | null;
    loserId: string | null;
    scores: string;
    underwayAt: string | null;
  };
}

interface ApiResponse<T> {
  data: T;
  included?: unknown[];
  meta?: unknown;
}

export class ChallongeClient {
  private apiKey: string;
  private authType: "v1" | "v2";

  constructor(config: ChallongeConfig) {
    this.apiKey = config.apiKey;
    this.authType = config.authType;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/vnd.api+json",
      Accept: "application/json",
      "Authorization-Type": this.authType,
    };

    if (this.authType === "v1") {
      headers.Authorization = this.apiKey;
    } else {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Challonge API Error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  // ==================== TOURNAMENTS ====================

  /**
   * List all tournaments
   */
  async listTournaments(params?: {
    state?: "pending" | "in_progress" | "ended";
    page?: number;
    per_page?: number;
  }): Promise<ApiResponse<Tournament[]>> {
    const query = new URLSearchParams();
    if (params?.state) query.set("state", params.state);
    if (params?.page) query.set("page", params.page.toString());
    if (params?.per_page) query.set("per_page", params.per_page.toString());

    const queryString = query.toString() ? `?${query.toString()}` : "";
    return this.request<ApiResponse<Tournament[]>>(
      "GET",
      `/tournaments${queryString}`,
    );
  }

  /**
   * Get a single tournament
   */
  async getTournament(tournamentId: string): Promise<ApiResponse<Tournament>> {
    return this.request<ApiResponse<Tournament>>(
      "GET",
      `/tournaments/${tournamentId}`,
    );
  }

  /**
   * Create a tournament
   */
  async createTournament(data: {
    name: string;
    url?: string;
    tournamentType?:
      | "single elimination"
      | "double elimination"
      | "round robin"
      | "swiss";
    description?: string;
    gameName?: string;
    startAt?: string;
    signupCap?: number;
    openSignup?: boolean;
  }): Promise<ApiResponse<Tournament>> {
    return this.request<ApiResponse<Tournament>>("POST", "/tournaments", {
      data: {
        type: "tournaments",
        attributes: {
          name: data.name,
          url: data.url,
          tournament_type: data.tournamentType ?? "single elimination",
          description: data.description,
          game_name: data.gameName ?? "Beyblade",
          start_at: data.startAt,
          signup_cap: data.signupCap,
          open_signup: data.openSignup ?? true,
        },
      },
    });
  }

  /**
   * Change tournament state (start, finalize, reset)
   */
  async changeTournamentState(
    tournamentId: string,
    state: "start" | "finalize" | "reset",
  ): Promise<ApiResponse<Tournament>> {
    return this.request<ApiResponse<Tournament>>(
      "PUT",
      `/tournaments/${tournamentId}/change_state`,
      {
        data: {
          type: "TournamentState",
          attributes: {
            state,
          },
        },
      },
    );
  }

  /**
   * Delete a tournament
   */
  async deleteTournament(tournamentId: string): Promise<void> {
    await this.request("DELETE", `/tournaments/${tournamentId}`);
  }

  // ==================== PARTICIPANTS ====================

  /**
   * List participants
   */
  async listParticipants(
    tournamentId: string,
  ): Promise<ApiResponse<Participant[]>> {
    return this.request<ApiResponse<Participant[]>>(
      "GET",
      `/tournaments/${tournamentId}/participants`,
    );
  }

  /**
   * Create a participant
   */
  async createParticipant(
    tournamentId: string,
    data: {
      name: string;
      email?: string;
      seed?: number;
      misc?: string;
    },
  ): Promise<ApiResponse<Participant>> {
    return this.request<ApiResponse<Participant>>(
      "POST",
      `/tournaments/${tournamentId}/participants`,
      {
        data: {
          type: "participants",
          attributes: {
            name: data.name,
            email: data.email,
            seed: data.seed,
            misc: data.misc,
          },
        },
      },
    );
  }

  /**
   * Bulk create participants
   */
  async bulkCreateParticipants(
    tournamentId: string,
    participants: { name: string; seed?: number }[],
  ): Promise<ApiResponse<Participant[]>> {
    return this.request<ApiResponse<Participant[]>>(
      "POST",
      `/tournaments/${tournamentId}/participants/bulk`,
      {
        data: participants.map((p) => ({
          type: "participants",
          attributes: {
            name: p.name,
            seed: p.seed,
          },
        })),
      },
    );
  }

  /**
   * Delete a participant
   */
  async deleteParticipant(
    tournamentId: string,
    participantId: string,
  ): Promise<void> {
    await this.request(
      "DELETE",
      `/tournaments/${tournamentId}/participants/${participantId}`,
    );
  }

  /**
   * Randomize participants seeding
   */
  async randomizeParticipants(tournamentId: string): Promise<void> {
    await this.request(
      "POST",
      `/tournaments/${tournamentId}/participants/randomize`,
    );
  }

  // ==================== MATCHES ====================

  /**
   * List matches
   */
  async listMatches(
    tournamentId: string,
    params?: { state?: "open" | "pending" | "complete" },
  ): Promise<ApiResponse<Match[]>> {
    const query = new URLSearchParams();
    if (params?.state) query.set("state", params.state);
    const queryString = query.toString() ? `?${query.toString()}` : "";

    return this.request<ApiResponse<Match[]>>(
      "GET",
      `/tournaments/${tournamentId}/matches${queryString}`,
    );
  }

  /**
   * Get a match
   */
  async getMatch(
    tournamentId: string,
    matchId: string,
  ): Promise<ApiResponse<Match>> {
    return this.request<ApiResponse<Match>>(
      "GET",
      `/tournaments/${tournamentId}/matches/${matchId}`,
    );
  }

  /**
   * Update a match (report scores)
   */
  async updateMatch(
    tournamentId: string,
    matchId: string,
    data: {
      winnerId: string;
      scoresCsv: string; // e.g. "3-2"
    },
  ): Promise<ApiResponse<Match>> {
    return this.request<ApiResponse<Match>>(
      "PUT",
      `/tournaments/${tournamentId}/matches/${matchId}`,
      {
        data: {
          type: "matches",
          attributes: {
            winner_id: data.winnerId,
            scores_csv: data.scoresCsv,
          },
        },
      },
    );
  }

  /**
   * Mark match as underway
   */
  async markMatchUnderway(
    tournamentId: string,
    matchId: string,
  ): Promise<ApiResponse<Match>> {
    return this.request<ApiResponse<Match>>(
      "PUT",
      `/tournaments/${tournamentId}/matches/${matchId}/change_state`,
      {
        data: {
          type: "MatchState",
          attributes: {
            state: "mark_underway",
          },
        },
      },
    );
  }
}

// Singleton instance
let challongeClient: ChallongeClient | null = null;

export function getChallongeClient(): ChallongeClient {
  if (!challongeClient) {
    const apiKey = process.env.CHALLONGE_API_KEY;
    if (!apiKey) {
      throw new Error("CHALLONGE_API_KEY environment variable is not set");
    }

    challongeClient = new ChallongeClient({
      apiKey,
      authType: "v1", // Using v1 key for simplicity
    });
  }
  return challongeClient;
}

export type { ApiResponse, Match, Participant, Tournament };
