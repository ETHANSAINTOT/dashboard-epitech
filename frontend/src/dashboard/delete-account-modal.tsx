import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearToken } from "../api";
import Field from "../components/field";
import Modal from "../components/modal";
import { dangerButtonStyle, errorStyle, hintStyle } from "../styles";

const DELETE_CONFIRMATION = "DELETEMYACCOUNT-FORCE";

// the account and all its data go only once DELETE_CONFIRMATION is typed. closed = what was typed is forgotten
export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canDelete = confirmation === DELETE_CONFIRMATION;

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await api<void>("/me", { method: "DELETE", auth: true, body: { confirmation } });
      clearToken();
      navigate("/");
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  return (
    <Modal title="Delete my account" onClose={onClose}>
      <form onSubmit={handleDelete} noValidate>
        <p style={hintStyle}>This permanently removes your account and all of its data. Type <strong>{DELETE_CONFIRMATION}</strong> to confirm.</p>
        <Field id="confirmation" label="Confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        {error && <p style={errorStyle}>{error}</p>}
        <button type="submit" disabled={!canDelete} style={{ ...dangerButtonStyle, marginTop: "10px", opacity: canDelete ? 1 : 0.5, cursor: canDelete ? "pointer" : "not-allowed" }}>
          Delete my account
        </button>
      </form>
    </Modal>
  );
}
