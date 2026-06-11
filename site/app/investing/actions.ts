"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../lib/supabase-server";
import {
  journalActions,
  newsImpacts,
  newsTimeframes,
  transactionTypes,
  watchlistStatuses,
  type JournalAction,
  type NewsImpact,
  type NewsTimeframe,
  type TransactionType,
  type WatchlistStatus,
} from "../../lib/investment-types";
import { normalizeTicker, nullableNumber, nullableText } from "../../lib/investment-data";

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: T[], fallback: T) {
  const candidate = String(value || "") as T;
  return allowed.includes(candidate) ? candidate : fallback;
}

async function ensureCompany(ticker: string, name?: string | null) {
  const { supabase, user } = await requireUser();
  const { data: existing, error: selectError } = await supabase
    .from("companies")
    .select("*")
    .eq("ticker", ticker)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    if (name && !existing.name) {
      const { data, error } = await supabase
        .from("companies")
        .update({ name })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      return data;
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ ticker, name: name || ticker, user_id: user.id })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function findSingleUserRow(table: string, ticker: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("ticker", ticker)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: string } | null;
}

export async function upsertCompany(formData: FormData) {
  const ticker = normalizeTicker(formData.get("ticker"));
  if (!ticker) {
    return;
  }

  const { supabase, user } = await requireUser();
  const id = nullableText(formData.get("id"));
  const payload = {
    ticker,
    name: nullableText(formData.get("name")),
    sector: nullableText(formData.get("sector")),
    industry: nullableText(formData.get("industry")),
    description: nullableText(formData.get("description")),
    user_id: user.id,
  };

  if (id) {
    const { error } = await supabase.from("companies").update(payload).eq("id", id);
    if (error) {
      throw error;
    }
  } else {
    const existing = await ensureCompany(ticker, payload.name);
    const { error } = await supabase.from("companies").update(payload).eq("id", existing.id);
    if (error) {
      throw error;
    }
  }

  revalidatePath("/investing");
  revalidatePath(`/investing/companies/${ticker}`);
}

export async function upsertHolding(formData: FormData) {
  const ticker = normalizeTicker(formData.get("ticker"));
  if (!ticker) {
    return;
  }

  const { supabase, user } = await requireUser();
  const company = await ensureCompany(ticker);
  const id = nullableText(formData.get("id"));
  const payload = {
    company_id: company.id,
    ticker,
    current_value: nullableNumber(formData.get("current_value")),
    latest_price: nullableNumber(formData.get("latest_price")),
    target_weight: nullableNumber(formData.get("target_weight")),
    notes: nullableText(formData.get("notes")),
    user_id: user.id,
  };

  const existing = id ? null : await findSingleUserRow("holdings", ticker);
  const query = id || existing
    ? supabase.from("holdings").update(payload).eq("id", id || existing?.id)
    : supabase.from("holdings").insert(payload);
  const { error } = await query;

  if (error) {
    throw error;
  }

  revalidatePath("/investing");
  revalidatePath(`/investing/companies/${ticker}`);
}

export async function upsertWatchlistItem(formData: FormData) {
  const ticker = normalizeTicker(formData.get("ticker"));
  if (!ticker) {
    return;
  }

  const { supabase, user } = await requireUser();
  const company = await ensureCompany(ticker);
  const id = nullableText(formData.get("id"));
  const payload = {
    company_id: company.id,
    ticker,
    status: oneOf<WatchlistStatus>(formData.get("status"), watchlistStatuses, "not_started"),
    reason: nullableText(formData.get("reason")),
    user_id: user.id,
  };

  const existing = id ? null : await findSingleUserRow("watchlist", ticker);
  const query = id || existing
    ? supabase.from("watchlist").update(payload).eq("id", id || existing?.id)
    : supabase.from("watchlist").insert(payload);
  const { error } = await query;

  if (error) {
    throw error;
  }

  revalidatePath("/investing");
  revalidatePath("/investing/watchlist");
  revalidatePath(`/investing/companies/${ticker}`);
}

export async function upsertThesis(formData: FormData) {
  const ticker = normalizeTicker(formData.get("ticker"));
  if (!ticker) {
    return;
  }

  const { supabase, user } = await requireUser();
  const company = await ensureCompany(ticker);
  const id = nullableText(formData.get("id"));
  const payload = {
    company_id: company.id,
    ticker,
    business_overview: nullableText(formData.get("business_overview")),
    growth_drivers: nullableText(formData.get("growth_drivers")),
    bull_case: nullableText(formData.get("bull_case")),
    bear_case: nullableText(formData.get("bear_case")),
    moat: nullableText(formData.get("moat")),
    key_risks: nullableText(formData.get("key_risks")),
    sell_conditions: nullableText(formData.get("sell_conditions")),
    confidence_score: nullableNumber(formData.get("confidence_score")),
    user_id: user.id,
  };

  const existing = id ? null : await findSingleUserRow("thesis_notes", ticker);
  const query = id || existing
    ? supabase.from("thesis_notes").update(payload).eq("id", id || existing?.id)
    : supabase.from("thesis_notes").insert(payload);
  const { error } = await query;

  if (error) {
    throw error;
  }

  revalidatePath("/investing");
  revalidatePath(`/investing/companies/${ticker}`);
}

export async function upsertDecision(formData: FormData) {
  const ticker = normalizeTicker(formData.get("ticker"));
  const { supabase, user } = await requireUser();
  const company = ticker ? await ensureCompany(ticker) : null;
  const id = nullableText(formData.get("id"));
  const payload = {
    company_id: company?.id || null,
    ticker: ticker || null,
    action: oneOf<JournalAction>(formData.get("action"), journalActions, "research"),
    amount: nullableNumber(formData.get("amount")),
    reason: nullableText(formData.get("reason")),
    confidence_score: nullableNumber(formData.get("confidence_score")),
    what_would_make_this_wrong: nullableText(formData.get("what_would_make_this_wrong")),
    user_id: user.id,
  };

  const query = id
    ? supabase.from("decision_journal").update(payload).eq("id", id)
    : supabase.from("decision_journal").insert(payload);
  const { error } = await query;

  if (error) {
    throw error;
  }

  revalidatePath("/investing");
  revalidatePath("/investing/journal");
  if (ticker) {
    revalidatePath(`/investing/companies/${ticker}`);
  }
}

export async function upsertNewsItem(formData: FormData) {
  const ticker = normalizeTicker(formData.get("ticker"));
  const title = nullableText(formData.get("title"));
  if (!ticker || !title) {
    return;
  }

  const { supabase, user } = await requireUser();
  const company = await ensureCompany(ticker);
  const id = nullableText(formData.get("id"));
  const payload = {
    company_id: company.id,
    ticker,
    title,
    url: nullableText(formData.get("url")),
    source: nullableText(formData.get("source")),
    published_at: nullableText(formData.get("published_at")),
    summary: nullableText(formData.get("summary")),
    impact: oneOf<NewsImpact>(formData.get("impact"), newsImpacts, "neutral"),
    timeframe: oneOf<NewsTimeframe>(formData.get("timeframe"), newsTimeframes, "short_term"),
    thesis_changed: formData.get("thesis_changed") === "on",
    my_note: nullableText(formData.get("my_note")),
    user_id: user.id,
  };

  const query = id
    ? supabase.from("news_items").update(payload).eq("id", id)
    : supabase.from("news_items").insert(payload);
  const { error } = await query;

  if (error) {
    throw error;
  }

  revalidatePath("/investing");
  revalidatePath(`/investing/companies/${ticker}`);
}

export async function addTransaction(formData: FormData) {
  const transactionType = oneOf<TransactionType>(formData.get("transaction_type"), transactionTypes, "buy");
  const ticker = normalizeTicker(formData.get("ticker"));
  const quantity = nullableNumber(formData.get("quantity"));
  const pricePerShare = nullableNumber(formData.get("price_per_share"));
  const { supabase, user } = await requireUser();
  const company = ticker ? await ensureCompany(ticker) : null;

  if (["buy", "sell"].includes(transactionType) && (!ticker || !quantity || quantity <= 0 || pricePerShare === null)) {
    throw new Error("Buy and sell transactions require ticker, positive quantity, and price.");
  }

  if (["deposit", "withdrawal", "dividend"].includes(transactionType) && pricePerShare === null) {
    throw new Error("Cash transactions require an amount.");
  }

  const { error } = await supabase.from("portfolio_transactions").insert({
    company_id: company?.id || null,
    ticker: ticker || null,
    transaction_type: transactionType,
    quantity,
    price_per_share: pricePerShare,
    fee: nullableNumber(formData.get("fee")) || 0,
    currency: String(formData.get("currency") || "USD").trim().toUpperCase(),
    transaction_date: String(formData.get("transaction_date") || new Date().toISOString().slice(0, 10)),
    reason: nullableText(formData.get("reason")),
    notes: nullableText(formData.get("notes")),
    user_id: user.id,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/investing");
  revalidatePath("/investing/journey");
  if (ticker) {
    revalidatePath(`/investing/companies/${ticker}`);
  }
}
