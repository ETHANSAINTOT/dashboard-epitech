class CatalogError(Exception):
    """Base class for every catalogue-level failure."""

class ConfigError(CatalogError):
    def __init__(self, errors: list[str]) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors

class WidgetUnavailable(CatalogError):
    """The stored instance points at a widget the catalogue no longer declares."""

class NotSubscribed(CatalogError):
    """The service requires a subscription the user does not have."""

class WidgetError(CatalogError):
    """The widget ran but could not produce data."""
