import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Field from "../components/field";
import { EMAIL_RE } from "../validation";
import { cardStyle, linkButtonStyle, pageStyle, primaryButtonStyle, subtitleStyle, successStyle, titleStyle } from "../styles";
import { api, setToken } from "../api";

type FieldName = "email" | "password";
type Errors = Partial<Record<FieldName, string>>;

export default function SignIn() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [success, setSuccess] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {setForm({ ...form, [event.target.name]: event.target.value }); setSuccess(false)};
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found: Errors = {};
    if (!EMAIL_RE.test(form.email)) 
      found.email = "Expected format: user@domain.com";
    if (!form.password) 
      found.password = "Password is required";
    setErrors(found);
    if (Object.keys(found).length > 0) 
      return;
    try {
      const { token } = await api<{ token: string }>("/auth/signin", {method: "POST", body: { email: form.email, password: form.password }});
      setToken(token);
      navigate("/dashboard");
    } catch (caught) {
      setErrors({ password: (caught as Error).message });
    }
  };

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSubmit} noValidate style={cardStyle}>
        <h1 style={titleStyle}>Dashboard</h1>
        <p style={subtitleStyle}>Sign in to your account</p>

        <Field id="email" label="Email" type="email" value={form.email} error={errors.email} onChange={handleChange} />
        <Field id="password" label="Password" type="password" value={form.password} error={errors.password} onChange={handleChange} />

        <button type="submit" style={{ ...primaryButtonStyle, marginTop: "10px" }}>Sign In</button>

        {success && <p style={successStyle}>Form is valid. Nothing is stored yet.</p>}

        <button type="button" onClick={() => navigate("/")} style={linkButtonStyle}>Back to home</button>
      </form>
    </main>
  );
}
