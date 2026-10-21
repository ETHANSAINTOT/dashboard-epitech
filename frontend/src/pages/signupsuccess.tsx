import { useNavigate } from "react-router-dom";
import { cardStyle, pageStyle, primaryButtonStyle, subtitleStyle, titleStyle } from "../styles";

export default function SignUpSuccess() {
  const navigate = useNavigate();

  return (
    <main style={pageStyle}>
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <h1 style={titleStyle}>Account created</h1>
        <p style={subtitleStyle}>Check your mailbox for account verification.</p>

        <button type="button" onClick={() => navigate("/")} style={primaryButtonStyle}>Back to home</button>
      </div>
    </main>
  );
}