"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import { fetchBackend } from "@/lib/config";

type AuthMode = "register" | "login";
const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_CLIENT_ID =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID) || "";
const hasValidGoogleClientId =
  GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com") &&
  !GOOGLE_CLIENT_ID.toLowerCase().includes("your_google_oauth_web_client_id_here");

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?:
                | "signin_with"
                | "signup_with"
                | "continue_with"
                | "signin";
              shape?: "pill" | "rectangular";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

const AccountAuth = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryUserId = searchParams?.get("userId") || null;
  const modeParam = searchParams?.get("mode");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const userId = useMemo(() => {
    if (queryUserId) return queryUserId;
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("soulbound_userId");
  }, [queryUserId]);

  const [mode, setMode] = useState<AuthMode>("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (modeParam === "login" || modeParam === "register") {
      setMode(modeParam);
    } else if (!queryUserId) {
      setMode("login");
    }
  }, [modeParam, queryUserId]);

  const finishAuth = useCallback(
    (payload: { userId: string; email?: string; hasProfile?: boolean }) => {
      if (!payload.hasProfile) {
        throw new Error("This account has no saved profile. Complete onboarding first.");
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("soulbound_userId", payload.userId);
        if (payload.email) {
          window.localStorage.setItem("soulbound_account_email", payload.email);
        }
      }
      router.push(`/lounge?userId=${encodeURIComponent(payload.userId)}`);
    },
    [router],
  );

  const handleGoogleCredential = useCallback(
    async (idToken?: string) => {
      if (!idToken) {
        setError("Google sign-in returned no token.");
        return;
      }

      setIsSubmitting(true);
      setError("");

      try {
        const response = await fetchBackend("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            userId: userId || undefined,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Google sign-in failed");
        }

        finishAuth(payload);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Google sign-in failed",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [finishAuth, userId],
  );

  useEffect(() => {
    if (!hasValidGoogleClientId || typeof window === "undefined") return;
    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          void handleGoogleCredential(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: mode === "register" ? "continue_with" : "signin_with",
        shape: "pill",
        width: 320,
      });
    };

    if (window.google) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.onload = () => {
      renderGoogleButton();
    };

    return () => {
      cancelled = true;
    };
  }, [handleGoogleCredential, mode]);

  const handleRegister = async () => {
    if (!userId) {
      setError("Missing saved profile. Please complete onboarding first.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetchBackend("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          password,
          displayName: displayName.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create account");
      }
      finishAuth(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Account creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetchBackend("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Login failed");
      }
      finishAuth(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LiquidSilkBg />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl glass-strong rounded-3xl p-6 md:p-8 space-y-6"
        >
          <div className="space-y-2 text-center">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Create Your <span className="text-gradient-rose">SoulBound Account</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Your profile is saved. Create an account to secure it and continue.
            </p>
            {userId && (
              <p className="text-xs text-muted-foreground/80 font-mono">
                Profile ID: {userId}
              </p>
            )}
          </div>

          <div className="flex rounded-xl bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name (optional)"
                className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
              />
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Password (min 8 chars)" : "Password"}
              className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
            />

            {mode === "register" && (
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-xl glass px-4 py-3 border border-border focus:border-primary outline-none text-sm"
              />
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border/50" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-border/50" />
            </div>

            {hasValidGoogleClientId ? (
              <div className="flex justify-center">
                <div ref={googleButtonRef} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Google sign-in is not configured with a valid OAuth client id.
                Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/onboarding")}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-sm hover:bg-muted/30 transition"
            >
              Back to Profile
            </button>
            <button
              type="button"
              onClick={mode === "register" ? handleRegister : handleLogin}
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {isSubmitting
                ? "Please wait..."
                : mode === "register"
                  ? "Create Account"
                  : "Login"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AccountAuth;
