import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { cardStyle, errorStyle, pageStyle, primaryButtonStyle, subtitleStyle, titleStyle } from "../styles";

type Status = "pending" | "done" | "failed";

export default function Verify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const token = params.get("token");

  useEffect(() => {
    // StrictMode runs effects twice in dev. Without this guard the second call would hit an already-consumed token and show a false failure
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setError("This link is missing its verification token.");
      setStatus("failed");
      return;
    }

    api("/auth/verify", { method: "POST", body: { token } })
      .then(() => setStatus("done"))
      .catch((caught: Error) => {
        setError(caught.message);
        setStatus("failed");
      });
  }, [token]);

  return (
    <main style={pageStyle}>
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <h1 style={titleStyle}>Account verification</h1>

        {status === "pending" && <p style={subtitleStyle}>Verifying your account...</p>}
        {status === "done" && <p style={subtitleStyle}>Your account is verified. You can now sign in.</p>}
        {status === "failed" && <p style={errorStyle}>{error}</p>}

        {status === "done" && <button type="button" onClick={() => navigate("/signin")} style={primaryButtonStyle}>Sign In</button>}
        {status === "failed" && <button type="button" onClick={() => navigate("/")} style={primaryButtonStyle}>Back to home</button>}
      </div>
    </main>
  );
}