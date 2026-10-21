import functools
import ipaddress
import time
from fastapi import APIRouter, Request
from catalog import serialize_catalog

router = APIRouter()

# the machine's own network address, written at each start by the host-ip service (docker-compose.yml):
# a container on the HOST network can see it, this one cannot
HOST_IP_FILE = "/host-ip/address"

# the gateway of this container's Docker network (172.19.0.1): a request from the machine running the project
# (http://localhost:8080) reaches Vite from it, its real address is lost on the way
@functools.cache
def _docker_gateway():
    try:
        with open("/proc/net/route") as routes:
            for line in routes.read().splitlines()[1:]:
                fields = line.split()
                # default route = destination 0.0.0.0. the gateway is written in hex, bytes reversed
                if fields[1] == "00000000":
                    return str(ipaddress.IPv4Address(bytes.fromhex(fields[2])[::-1]))
    except (OSError, ValueError):
        pass
    return None

def _host_ip():
    try:
        with open(HOST_IP_FILE) as file:
            return file.read().strip() or None
    except OSError:
        return None

def client_host(request: Request) -> str:
    # Behind the Vite proxy, request.client.host is the proxy container's address
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # the LAST one: Vite (xfwd) appends the address it sees, everything before it was sent by the client and can
        # be faked ("X-Forwarded-For: 1.2.3.4"). safe because the backend is only reachable through Vite (expose, not ports)
        host = forwarded.split(",")[-1].strip()
    else:
        host = request.client.host if request.client else "unknown"
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return host
    mapped = getattr(address, "ipv4_mapped", None)
    host = str(mapped) if mapped else host
    # from the Docker gateway = from the machine itself: its network address. any other device keeps its own address
    if host == _docker_gateway():
        return _host_ip() or host
    return host

@router.get("/about.json")
async def about(request: Request) -> dict:
    return {
        "client": {"host": client_host(request)},
        "server": {"current_time": int(time.time()), "services": serialize_catalog()}
    }
