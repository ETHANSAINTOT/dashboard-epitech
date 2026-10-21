import uuid
from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator, StrictBool
from pydantic.alias_generators import to_camel
from typing import Annotated, Any
from catalog.translate import LANGUAGES, MAX_CHARS

# our own floor, not google's: 1 gmail refresh = 5 + 20 units per mail, quota = 6000 units/min per address
# at 10 s a 20-mail widget uses 40% of it, at 1 s even a 5-mail one goes over
REFRESH_MIN_SECONDS = 10
# 24 h. also keeps the front's setTimeout far below its ~24.8 days overflow
REFRESH_MAX_SECONDS = 86400

def max_three_decimal(value):
    # ms precision: 12.5 or 12.125 ok, 12.1255 refused (explicit 422, no silent rounding)
    if round(value, 3) != value:
        raise ValueError("Value must have at most three decimal places")
    return value

# one reusable type for both schemas: the bounds + the decimals check
RefreshSeconds = Annotated[float, Field(ge=REFRESH_MIN_SECONDS, le=REFRESH_MAX_SECONDS), AfterValidator(max_three_decimal)]

class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

class SignUpRequest(CamelModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=16)
    # the "I accept the Terms of Service" box: only a real true counts ("yes", 1... are refused). missing = not accepted.
    # validate_default: else pydantic skips the check below when the field is simply left out, and the signup goes through
    accept_terms: StrictBool = Field(default=False, validate_default=True)

    @field_validator("accept_terms")
    @classmethod
    # same check as the form: anyone can POST here without ticking anything
    def terms_accepted(cls, value: bool) -> bool:
        if not value:
            raise ValueError("You must accept the Terms of Service")
        return value

    @field_validator("password")
    @classmethod
    # Deliberately duplicates validation.ts. The browser-side check is only UX: anyone can POST straight to this endpoint.
    def strong_enough(cls, value: str) -> str:
        checks = [
            (any(c.isupper() for c in value), "at least one uppercase letter"),
            (any(c.islower() for c in value), "at least one lowercase letter"),
            (any(c.isdigit() for c in value), "at least one digit"),
            (any(not c.isalnum() for c in value), "at least one special character"),
        ]
        missing = [message for passed, message in checks if not passed]
        if missing:
            raise ValueError("Password needs " + ", ".join(missing))
        return value

class SignInRequest(CamelModel):
    email: EmailStr
    password: str

class TokenResponse(CamelModel):
    token: str

class UserResponse(CamelModel):
    client_id: uuid.UUID
    first_name: str
    last_name: str
    email: EmailStr

class DeleteAccountRequest(CamelModel):
    confirmation: str

class VerifyRequest(CamelModel):
    token: str

class WidgetCreate(CamelModel):
    service_name: str
    widget_name: str
    config: dict[str, Any] = {}
    # out of bounds = explicit 422 instead of a silent correction
    refresh_seconds: RefreshSeconds = 300.0
    x: int | None = Field(default=None, ge=0, le=100000)
    y: int | None = Field(default=None, ge=0, le=100000)
    # 1 for a new widget, the original's zoom for a duplicate
    scale: float = Field(default=1.0, ge=1, le=2)

class WidgetUpdate(CamelModel):
    config: dict[str, Any] | None = None
    refresh_seconds: RefreshSeconds | None = None
    x: int | None = Field(default=None, ge=0, le=100000)
    y: int | None = Field(default=None, ge=0, le=100000)
    # card zoom: 1 = the size it appears with (minimum), 2 = twice as big
    scale: float | None = Field(default=None, ge=1, le=2)

class WidgetReorder(CamelModel):
    ids: list[int]

class WidgetResponse(CamelModel):
    id: int
    service_name: str
    widget_name: str
    config: dict[str, Any]
    refresh_seconds: float
    position: int
    x: int | None
    y: int | None
    scale: float

# body of POST /api/translate. same checks as the front, but anyone can POST here directly
class TranslateRequest(CamelModel):
    text: str
    source: str
    target: str

    @field_validator("text")
    @classmethod
    def fits_the_api(cls, value):
        if not value.strip():
            raise ValueError("Text cannot be empty")
        # characters (code points), counted like Array.from(text).length on the front
        if len(value) > MAX_CHARS:
            raise ValueError(f"Text is too long: {MAX_CHARS} characters max")
        return value

    @field_validator("source", "target")
    @classmethod
    def known_language(cls, value):
        if value not in LANGUAGES:
            raise ValueError("Unsupported language")
        return value
