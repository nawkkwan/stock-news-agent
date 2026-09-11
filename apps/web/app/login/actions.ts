"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase-server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const nextPath = String(formData.get("next") || "/investing");
  let errorMessage = "";
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    errorMessage = error?.message || "";
  } catch {
    errorMessage = "Authentication service is temporarily unavailable.";
  }

  if (errorMessage) redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
  redirect(nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/investing");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
