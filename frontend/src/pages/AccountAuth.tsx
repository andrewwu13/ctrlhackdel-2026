"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import LiquidSilkBg from "@/components/LiquidSilkBg";
import { fetchBackend } from "@/lib/config";

type AuthMode = "register" | "login";

const AccountAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationUserId = (location.state as { userId?: string } | null)?.userId || null;

  const userId = useMemo(() => {
    if (locationUserId) return locationUserId;
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("soulbound_userId");
  }, [locationUserId]);

  const [mode, setMode] = useState<AuthMode>("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      if (typeof window !== "undefined") {
        window.localStorage.setItem("soulbound_userId", payload.userId);
        window.localStorage.setItem("soulbound_account_email", payload.email);
      }

      navigate("/lounge", { state: { userId: payload.userId } });
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

      if (!payload.hasProfile) {
        throw new Error("This account has no saved profile. Complete onboarding first.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("soulbound_userId", payload.userId);
        window.localStorage.setItem("soulbound_account_email", payload.email);
      }

      navigate("/lounge", { state: { userId: payload.userId } });
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/onboarding")}
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
