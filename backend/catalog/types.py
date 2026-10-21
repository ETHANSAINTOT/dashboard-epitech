from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal

ParamType = Literal["string", "integer"]
# Every widget exposes the same signature: (config, credentials) -> data - credentials is None for services that need no subscription
FetchFn = Callable[[dict[str, Any], dict[str, Any] | None], Awaitable[dict[str, Any]]]

@dataclass(frozen=True)
class Param:
    name: str
    type: ParamType
    description: str = ""
    required: bool = True
    default: Any = None
    # allowed values, () = anything. written as text, integer params too: ("1", ..., "7")
    choices: tuple[str, ...] = ()

@dataclass(frozen=True)
class Widget:
    name: str
    description: str
    params: list[Param]
    fetch: FetchFn

@dataclass(frozen=True)
class Service:
    name: str
    widgets: list[Widget]
    requires_subscription: bool = False
