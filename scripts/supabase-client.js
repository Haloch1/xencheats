import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = authConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

export function getAuthConfigMessage() {
  return "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to turn on sign up and sign in.";
}

export async function getCurrentSession() {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.session) {
      return data.session;
    }
  } catch {
    // Fall back to Supabase browser storage below.
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function getAccessToken() {
  const session = await getCurrentSession();
  return session?.access_token || null;
}

export async function signInWithServerSession(email, password) {
  const response = await fetch("/api/auth/sign-in", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to sign in.");
  }

  return data.session ?? null;
}

export async function signUpWithServerSession(email, password) {
  const response = await fetch("/api/auth/sign-up", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to create account.");
  }

  return data.session ?? null;
}

export async function clearServerSession() {
  await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "same-origin",
  });
}
