import bundledReport from "../data/latest-report.json";
import { createSupabaseServerClient, hasSupabaseConfig } from "./supabase-server";

type BriefingResponse = {
  briefing?: {
    payload?: unknown;
  } | null;
};

export async function getLatestReport<T>(): Promise<T | null> {
  if (!hasSupabaseConfig()) return bundledReport as T;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return null;

    const { data, error } = await supabase
      .from("daily_briefings")
      .select("payload")
      .eq("user_id", userData.user.id)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.payload) return null;
    return data.payload as T;
  } catch {
    // Never fall back to another account's bundled report in multi-user mode.
    return null;
  }
}
