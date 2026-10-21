from typing import Any
from . import weather, rss, gmail, clock, translate, cheapshark, github
from .errors import ConfigError
from .types import Service, Widget

CATALOG: list[Service] = [weather.SERVICE, rss.SERVICE, gmail.SERVICE, clock.SERVICE, translate.SERVICE, cheapshark.SERVICE, github.SERVICE]
INDEX: dict[tuple[str, str], tuple[Service, Widget]] = {(service.name, widget.name): (service, widget) for service in CATALOG for widget in service.widgets}

def find_widget(service_name: str, widget_name: str) -> tuple[Service, Widget] | None:
    return INDEX.get((service_name, widget_name))

def serialize_catalog() -> list[dict[str, Any]]:
    return [{
            "name": service.name,
            "widgets": [
                {
                    "name": widget.name,
                    "description": widget.description,
                    "params": [{"name": p.name, "type": p.type} 
                    for p in widget.params] 
                } for widget in service.widgets]} 
        for service in CATALOG]

def validate_config(widget: Widget, raw: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    errors: list[str] = []

    for param in widget.params:
        if param.name not in raw:
            if param.required and param.default is None:
                errors.append(f"{param.name} is required")
            else:
                clean[param.name] = param.default
            continue
        value = raw[param.name]
        if param.type == "integer":
            if isinstance(value, bool): #not become 0 or 1
                errors.append(f"{param.name} must be an integer")
            else:
                try:
                    number = int(value)
                except (TypeError, ValueError):
                    errors.append(f"{param.name} must be an integer")
                else:
                    # integer choices are written as text too: ("1", ..., "7")
                    if param.choices and str(number) not in param.choices:
                        errors.append(f"{param.name} must be one of: {', '.join(param.choices)}")
                    else:
                        clean[param.name] = number
        elif not isinstance(value, str):
            errors.append(f"{param.name} must be a string")
        elif not value.strip():
            errors.append(f"{param.name} cannot be empty")
        # empty choices = any text is fine (city, ...)
        elif param.choices and value.strip() not in param.choices:
            errors.append(f"{param.name} must be one of: {', '.join(param.choices)}")
        else:
            clean[param.name] = value.strip()
    if errors:
        raise ConfigError(errors)
    return clean
