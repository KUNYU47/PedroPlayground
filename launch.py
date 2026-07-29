#!/usr/bin/env python3
"""
Pedro Playground launcher.

Serves the built app locally and opens it in your system browser.
Everything (including the Python interpreter that runs student code) then
executes inside the browser — no server-side logic at all.

Like the legacy desktop app, the launcher also creates `worlds/` and
`scaffolds/` folders next to this script on first run (seeded with the
built-in files). Files in those folders take priority over the built-in
ones: edit them to customize worlds and starter code, or drop in new
`<name>.txt` world files to make them appear in the world's dropdown.
Delete a file to fall back to the built-in version.

Usage:
    python3 launch.py            # serve dist/ and open the browser
    python3 launch.py --build    # run "npm run build" first, then serve
    python3 launch.py --port 8000
"""
import argparse
import http.server
import json
import os
import posixpath
import shutil
import subprocess
import threading
import urllib.parse
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")

# Folders the user may customize; served with priority over dist/.
USER_DIRS = ("worlds", "scaffolds")
USER_EXTS = {"worlds": ".txt", "scaffolds": ".py"}


def build() -> None:
    print("📦 Building Pedro Playground (npm run build)…")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    try:
        subprocess.check_call([npm, "run", "build"], cwd=ROOT)
    except FileNotFoundError:
        raise SystemExit("❌ npm not found. Please install Node.js first (https://nodejs.org).")


def seed_user_dirs() -> None:
    """First run: copy the bundled worlds/scaffolds next to this script so
    users can edit them (mirrors the legacy app's behaviour)."""
    for name in USER_DIRS:
        user_dir = os.path.join(ROOT, name)
        bundled = os.path.join(DIST, name)
        if os.path.isdir(user_dir) or not os.path.isdir(bundled):
            continue
        shutil.copytree(bundled, user_dir)
        print(f"📁 Created {name}/ — files there override the built-in ones.")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIST, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        # Never cache: rebuilt assets must show up on plain refresh.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def translate_path(self, path):
        """Serve user-folder files with priority over dist/ for
        /worlds/* and /scaffolds/* (path-traversal safe)."""
        clean = posixpath.normpath(urllib.parse.unquote(path.split("?", 1)[0]))
        parts = [p for p in clean.split("/") if p and p != "."]
        if len(parts) == 2 and parts[0] in USER_DIRS and parts[1] != "..":
            candidate = os.path.join(ROOT, parts[0], parts[1])
            if os.path.isfile(candidate):
                return candidate
        return super().translate_path(path)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/user-files":
            self._handle_user_files(parsed)
            return
        super().do_GET()

    def _handle_user_files(self, parsed):
        """JSON list of user-provided world/scaffold names (no extension)."""
        params = urllib.parse.parse_qs(parsed.query)
        kind = params.get("type", [""])[0]
        if kind not in USER_DIRS:
            self.send_error(400, "type must be one of: " + ", ".join(USER_DIRS))
            return
        folder = os.path.join(ROOT, kind)
        ext = USER_EXTS[kind]
        names = []
        if os.path.isdir(folder):
            names = sorted(
                f[: -len(ext)]
                for f in os.listdir(folder)
                if f.endswith(ext) and os.path.isfile(os.path.join(folder, f))
            )
        body = json.dumps(names).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Pedro Playground launcher")
    parser.add_argument("--build", action="store_true", help="build the app before serving")
    parser.add_argument("--port", type=int, default=8471, help="port to serve on (default: 8471)")
    parser.add_argument("--no-browser", action="store_true", help="do not open the browser")
    args = parser.parse_args()

    if args.build or not os.path.isdir(DIST):
        build()

    seed_user_dirs()

    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), QuietHandler)
    except OSError:
        raise SystemExit(f"❌ Port {args.port} is already in use. Try --port {args.port + 1} "
                         "or stop the other Pedro Playground instance.")
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
