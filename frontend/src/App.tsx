import { useNavigate } from "react-router-dom";
import { LEGAL_URL } from "./legal";
import { legalLinkStyle } from "./styles";

export default function App() {
  const navigate = useNavigate();

  return (
    // a column: the white card, then the legal link under it
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", gap: "20px", justifyContent: "center", alignItems: "center", backgroundColor: "#e8f5e9", fontFamily: "Arial, sans-serif", padding: "20px", boxSizing: "border-box" }}>
      {/* border-box: 490px padding included (= 420 + 2 x 35, as before), the legal link under it shares that width */}
      <div style={{ width: "100%", maxWidth: "490px", boxSizing: "border-box", backgroundColor: "#fff", padding: "45px 35px", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 10px", fontSize: "36px", color: "#1b5e20" }}>Dashboard</h1>
        <p style={{ margin: "0 0 35px", color: "#666", fontSize: "16px" }}>Select an option</p>

        <h2 style={{ fontSize: "22px", marginBottom: "15px", color: "#333" }}>New User</h2>
        <button onClick={() => navigate("/signup")} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "10px", backgroundColor: "#43a047", color: "#fff", fontSize: "16px", fontWeight: "bold", cursor: "pointer", marginBottom: "30px" }}>
          Sign Up
        </button>

        <div style={{ height: "1px", backgroundColor: "#e0e0e0", marginBottom: "25px" }} />

        <h2 style={{ fontSize: "18px", fontWeight: "normal", marginBottom: "15px", color: "#555" }}>Have already an Account?</h2>
        <button onClick={() => navigate("/signin")} style={{ width: "100%", padding: "14px", border: "2px solid #43a047", borderRadius: "10px", backgroundColor: "#fff", color: "#2e7d32", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>
          Sign In
        </button>
      </div>

      {/* new tab: the dashboard is never closed or replaced */}
      <a href={LEGAL_URL} target="_blank" rel="noreferrer" className="link-button" style={legalLinkStyle}>
        Legal notice<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </main>
  );
}
