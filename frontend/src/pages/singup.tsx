import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Field from "../components/field";
import { EMAIL_RE, validatePassword } from "../validation";
import {
  cardStyle,
  errorStyle,
  hintStyle,
  linkButtonStyle,
  pageStyle,
  primaryButtonStyle,
  subtitleStyle,
  successStyle,
  termsBlockStyle,
  termsCheckboxStyle,
  termsLabelStyle,
  termsLinkStyle,
  termsRowStyle,
  titleStyle,
} from "../styles";
import { api } from "../api";
import { TERMS_URL } from "../legal";

type FieldName = "firstName" | "lastName" | "email" | "password" | "confirm" | "acceptTerms";
type Errors = Partial<Record<FieldName, string>>;

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirm: "" });
  // apart from form: a checkbox gives checked (true / false), not a text value
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [success, setSuccess] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {setForm({ ...form, [event.target.name]: event.target.value }); setSuccess(false)};

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const found: Errors = {};
      if (!form.firstName.trim()) found.firstName = "First name is required";
      if (!form.lastName.trim()) found.lastName = "Last name is required";
      if (!EMAIL_RE.test(form.email)) found.email = "Expected format: user@domain.com";
      // never pre-ticked: consent must be the user's own action (GDPR)
      if (!acceptTerms) found.acceptTerms = "You must accept the Terms of Service";

      const passwordError = validatePassword(form.password);
      if (passwordError) 
        found.password = passwordError;
      if (form.confirm !== form.password) 
        found.confirm = "Passwords do not match";

      setErrors(found);
      if (Object.keys(found).length > 0) 
        return;

      try {
        await api("/auth/signup", {method: "POST", body: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email, password: form.password, acceptTerms }});
        navigate("/signupsuccess");
      } catch (caught) {
        setErrors({ email: (caught as Error).message });
      }
    };

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSubmit} noValidate style={cardStyle}>
        <h1 style={titleStyle}>Dashboard</h1>
        <p style={subtitleStyle}>Create your account</p>

        <Field id="firstName" label="First name" value={form.firstName} error={errors.firstName} onChange={handleChange} />
        <Field id="lastName" label="Last name" value={form.lastName} error={errors.lastName} onChange={handleChange} />
        <Field id="email" label="Email" type="email" value={form.email} error={errors.email} onChange={handleChange} />
        <Field id="password" label="Password" type="password" value={form.password} error={errors.password} onChange={handleChange} maxLength={16} />
        <Field id="confirm" label="Confirm password" type="password" value={form.confirm} error={errors.confirm} onChange={handleChange} maxLength={16} />

        <p style={hintStyle}> 12 to 16 characters, including at least one uppercase letter, one lowercase letter, one digit and one special character. </p>
        <div style={termsBlockStyle}>
          <div style={termsRowStyle}>
            <input
              type="checkbox"
              id="acceptTerms"
              checked={acceptTerms}
              onChange={(event) => {
                setAcceptTerms(event.target.checked);
                setSuccess(false);
              }}
              aria-invalid={Boolean(errors.acceptTerms)}
              aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
              style={termsCheckboxStyle}
            />
            {/* a click on the label ticks the box, a click on the link only opens the terms (new tab: the form stays filled) */}
            <label htmlFor="acceptTerms" style={termsLabelStyle}>
              I accept the{" "}
              <a href={TERMS_URL} target="_blank" rel="noreferrer" style={termsLinkStyle}>
                Terms of Service<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </label>
          </div>
          {errors.acceptTerms && (
            <p id="acceptTerms-error" role="alert" style={errorStyle}>
              {errors.acceptTerms}
            </p>
          )}
        </div>

        <button type="submit" style={primaryButtonStyle}>Sign Up</button>

        {success && <p style={successStyle}>Form is valid. Nothing is stored yet.</p>}

        <button type="button" onClick={() => navigate("/")} style={linkButtonStyle}>Back to home</button>
      </form>
    </main>
  );
}
