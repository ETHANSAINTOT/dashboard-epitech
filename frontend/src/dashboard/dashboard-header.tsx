import { useNavigate } from "react-router-dom";
import { clearToken } from "../api";
import { LEGAL_URL } from "../legal";
import { dashboardPillStyle, legalLinkHeaderStyle, signOutButtonStyle, welcomeStyle } from "../styles";

// layout and sizes in index.css: on a phone, welcome + sign out on one row, the title under them
export default function DashboardHeader({ firstName }: { firstName: string }) {
  const navigate = useNavigate();
  const signOut = () => {
    clearToken();
    navigate("/");
  };

  return (
    <header className="dashboard-header">
      <p className="dashboard-welcome" style={welcomeStyle}>Welcome {firstName}</p>
      <button type="button" className="dashboard-title" onClick={() => window.location.reload()} style={dashboardPillStyle}>Dashboard</button>
      {/* new tab: the dashboard is never closed or replaced */}
      <div className="dashboard-header-actions">
        <a href={LEGAL_URL} target="_blank" rel="noreferrer" className="dashboard-signout link-button" style={legalLinkHeaderStyle}>
          Legal notice<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" className="dashboard-signout" onClick={signOut} style={signOutButtonStyle}>Sign out</button>
      </div>
    </header>
  );
}
