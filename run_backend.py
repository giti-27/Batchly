import os
import sys
import socket
import argparse
import uvicorn

def check_port_available(host: str, port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((host, port))
            return True
    except Exception:
        return False

def find_available_port(host: str, preferred_port: int, fallback_ports=(8000, 8001, 8002, 8080)) -> int:
    if check_port_available(host, preferred_port):
        return preferred_port
    for p in fallback_ports:
        if p != preferred_port and check_port_available(host, p):
            return p
    return preferred_port

def main():
    parser = argparse.ArgumentParser(description="Run Batchly FastAPI Backend")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")), help="Port to bind (default: $PORT or 8000)")
    parser.add_argument("--host", type=str, default=os.getenv("HOST", "127.0.0.1"), help="Host to bind (default: $HOST or 127.0.0.1)")
    parser.add_argument("--reload", action="store_true", default=True, help="Enable auto-reload")
    args = parser.parse_args()

    port = args.port
    host = args.host

    if not check_port_available(host, port):
        alt_port = find_available_port(host, port)
        if alt_port != port:
            print(f"[BATCHLY WARNING] Port {port} is occupied or blocked by OS. Auto-selected available port {alt_port}.")
            port = alt_port
        else:
            print(f"[BATCHLY ERROR] Could not bind to port {port}. Please check access permissions or close any process using it.")

    print("=" * 60)
    print(f"  BATCHLY OPERATIONS API STARTING")
    print(f"  Host: {host}")
    print(f"  Port: {port}")
    print(f"  Swagger Docs: http://localhost:{port}/docs")
    print(f"  Health Check: http://localhost:{port}/health")
    print("=" * 60)

    uvicorn.run(
        "api.app.main:app",
        host=host,
        port=port,
        reload=args.reload
    )

if __name__ == "__main__":
    main()
