#!/usr/bin/env python3
"""Zero-dependency local server for the AURELIA island experience."""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def configured_port() -> int:
    try:
        value = int((ROOT / "port.txt").read_text(encoding="utf-8").strip())
        if not 1 <= value <= 65535:
            raise ValueError
        return value
    except (OSError, ValueError):
        raise SystemExit("port.txt must contain a valid port number (1–65535)")


class IslandHandler(SimpleHTTPRequestHandler):
    server_version = "Aurelia/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "static"), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache" if self.path == "/" else "public, max-age=3600")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/config":
            body = json.dumps({"seed": 84721, "islandName": "Aurelia", "size": 1280}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[Aurelia] {self.address_string()} — {fmt % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the Aurelia interactive island")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    args = parser.parse_args()
    port = configured_port()
    mimetypes.add_type("text/javascript", ".js")
    server = ThreadingHTTPServer((args.host, port), IslandHandler)
    print(f"\n  AURELIA is ready at http://{args.host}:{port}\n  Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down…")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
