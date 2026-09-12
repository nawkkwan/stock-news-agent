import bundledReport from "../data/latest-report.json";

type BriefingResponse = {
  briefing?: {
    payload?: unknown;
  } | null;
};

export async function getLatestReport<T>(): Promise<T | null> {
  const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  const internalToken = process.env.INTERNAL_API_TOKEN;
  const discordOwnerId = process.env.DISCORD_OWNER_USER_ID;

  if (apiBaseUrl && internalToken && discordOwnerId) {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/briefings/latest`, {
        headers: {
          authorization: `Bearer ${internalToken}`,
          "x-discord-user-id": discordOwnerId,
        },
        next: { revalidate: 60 },
      });

      if (response.ok) {
        const result = (await response.json()) as BriefingResponse;
        if (result.briefing?.payload) {
          return result.briefing.payload as T;
        }
      }
    } catch {
      // Keep the site available while Azure or Supabase is temporarily unavailable.
    }
  }

  return bundledReport as T;
}
