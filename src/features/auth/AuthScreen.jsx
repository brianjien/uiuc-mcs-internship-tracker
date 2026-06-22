import { useEffect, useRef, useState } from "react";
import { profilePresets } from "../../config/appConfig.jsx";
import { GOOGLE_CLIENT_ID, readAuthRedirectMessage } from "../../lib/auth.js";
import { classNames, ProfileImagePicker } from "../../components/ui.jsx";

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function GoogleSignInButton({ disabled = false, onCredential }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;

    async function renderGoogleButton() {
      try {
        await loadGoogleIdentityScript();
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          itp_support: true,
          callback: async (response) => {
            if (!response?.credential || !onCredentialRef.current) {
              setError("Google did not return a sign-in credential.");
              return;
            }
            setBusy(true);
            setError("");
            const result = await onCredentialRef.current(response.credential);
            if (result?.error) setError(result.error);
            setBusy(false);
          },
        });
        buttonRef.current.innerHTML = "";
        const slotWidth = buttonRef.current.closest(".auth-form")?.clientWidth || buttonRef.current.clientWidth || 320;
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: "continue_with",
          width: Math.max(220, Math.min(slotWidth, 380)),
        });
        setReady(true);
      } catch {
        setReady(false);
        setError("Google sign-in could not load. Use email login or refresh.");
      }
    }

    renderGoogleButton();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={classNames("google-auth-slot", (disabled || busy) && "is-disabled", !ready && "is-loading")}>
      <div ref={buttonRef} />
      {!ready && <span>Loading Google sign-in</span>}
      {busy && <span>Signing in with Google</span>}
      {error && <span className="google-auth-error">{error}</span>}
    </div>
  );
}

export function AuthScreen({ onLogin, onRegister, onGoogleCredential }) {
  const [mode, setMode] = useState("register");
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    password: "",
    avatar: profilePresets[0].src,
  });
  const [error, setError] = useState(readAuthRedirectMessage);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.email.trim() || !draft.password) {
      setError("Email and password are required.");
      return;
    }
    if (isRegister && draft.password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setLoading(true);
    const result = isRegister ? await onRegister(draft) : await onLogin(draft);
    if (result?.error) setError(result.error);
    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-visual">
          <img src={draft.avatar} alt="" />
          <div>
            <strong>Career Tracker</strong>
            <span>Internship + New Grad</span>
          </div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div>
            <p>{isRegister ? "Create account" : "Welcome back"}</p>
            <h1>{isRegister ? "Register your tracker" : "Log in to your tracker"}</h1>
          </div>
          {isRegister && (
            <label>
              Name
              <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={draft.password}
              onChange={(event) => update("password", event.target.value)}
              placeholder="Database account password"
            />
          </label>
          {isRegister && <ProfileImagePicker value={draft.avatar} onChange={(avatar) => update("avatar", avatar)} compact />}
          {error && <span className="auth-error">{error}</span>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Connecting" : isRegister ? "Create Account" : "Log In"}
          </button>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <GoogleSignInButton disabled={loading} onCredential={onGoogleCredential} />
          <button
            className="text-button auth-switch"
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
          >
            {isRegister ? "Already have an account? Log in" : "Need an account? Register"}
          </button>
        </form>
      </section>
    </main>
  );
}
