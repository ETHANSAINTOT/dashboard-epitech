import smtplib
from email.message import EmailMessage
from config import APP_BASE_URL, CONFIRMATION_EXPIRES_HOURS, EMAIL_VERIFICATION, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER

def send_verification_email(to: str, first_name: str, token: str) -> None:
    link = f"{APP_BASE_URL}/verify?token={token}"
    # the real lifetime of the link (routes/auth.py), not a fixed "24 hours"
    hours = f"{CONFIRMATION_EXPIRES_HOURS} hour{'' if CONFIRMATION_EXPIRES_HOURS == 1 else 's'}"

    message = EmailMessage()
    message["From"] = EMAIL_VERIFICATION
    message["To"] = to
    message["Subject"] = "Confirm your Dashboard account"
    message.set_content(f"Hello {first_name},\n\n"f"Confirm your account by opening this link:\n{link}\n\n" f"This link expires in {hours}.\n" f"If you did not create this account, ignore this email.")

    # A mail failure must not break signup: the account exists, only the email is lost
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            # Gmail rejects credentials over a clear channel: upgrade to TLS first.
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        print(f"[mail] could not send verification to {to}: {error}")