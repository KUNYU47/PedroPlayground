#!/usr/bin/env python3
"""
Pedro Playground launcher.

Serves the built app locally and opens it in your system browser.
Everything (including the Python interpreter that runs student code) then
executes inside the browser — no server-side logic at all.

Usage:
    python3 launch.py            # serve dist/ and open the browser
    python3 launch.py --build    # run "npm run build" first, then serve
    python3 launch.py --port 8000
"""
import argparse
import http.server
import os
import subprocess
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")


def build() -> None:
    print("📦 Building Pedro Playground (npm run build)…")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.check_call([npm, "run", "build"], cwd=ROOT)


def main() -> None:
    parser = argparse.ArgumentParser(description="Pedro Playground launcher")
    parser.add_argument("--build", action="store_true", help="build the app before serving")
    parser.add_argument("--port", type=int, default=8471, help="port to serve on (default: 8471)")
    parser.add_argument("--no-browser", action="store_true", help="do not open the browser")
    args = parser.parse_args()

    if args.build or not os.path.isdir(DIST):
        build()

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=DIST, **kw)

        def log_message(self, *a):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), QuietHandler)
    url = f"http://127.0.0.1:{args.port}/"

    print(f"\n🧑‍🚀 Pedro Playground is running at {url}")
    print("   Press Ctrl+C to stop.\n")

    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Bye!")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
