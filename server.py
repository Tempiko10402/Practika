"""
Прокси-сервер: раздаёт HTML-файлы и перенаправляет /api/* запросы на бэкенд.
Запуск: python server.py
"""
import http.server
import urllib.request
import urllib.error
import json
import os

BACKEND = "http://192.168.89.58:5104"
PORT = 8080
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))


class ProxyHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    # ── CORS headers on every response ──────────────────────────────────────
    def add_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept")

    def do_OPTIONS(self):
        self.send_response(200)
        self.add_cors_headers()
        self.end_headers()

    # ── Forward /api/* to backend ────────────────────────────────────────────
    def do_POST(self):
        if self.path.startswith("/api/"):
            self._proxy_request("POST")
        else:
            super().do_POST()

    def do_GET(self):
        if self.path.startswith("/api/"):
            self._proxy_request("GET")
        else:
            super().do_GET()

    def do_PUT(self):
        if self.path.startswith("/api/"):
            self._proxy_request("PUT")

    def do_DELETE(self):
        if self.path.startswith("/api/"):
            self._proxy_request("DELETE")

    def _proxy_request(self, method):
        target_url = BACKEND + self.path

        # Read request body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        # Forward headers
        forward_headers = {}
        for key in ("Content-Type", "Authorization", "Accept"):
            val = self.headers.get(key)
            if val:
                forward_headers[key] = val
        if body and "Content-Type" not in forward_headers:
            forward_headers["Content-Type"] = "application/json; charset=utf-8"

        # Debug: log what we send
        print(f"\n  → {method} {target_url}")
        print(f"  → Headers: {forward_headers}")
        if body:
            print(f"  → Body:    {body.decode('utf-8', errors='replace')}")

        try:
            req = urllib.request.Request(
                target_url,
                data=body,
                headers=forward_headers,
                method=method,
            )
            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read()
                print(f"  ← Status: {resp.status}")
                print(f"  ← Body:   {resp_body.decode('utf-8', errors='replace')}\n")
                self.send_response(resp.status)
                ct = resp.headers.get("Content-Type", "application/json")
                self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(resp_body)))
                self.add_cors_headers()
                self.end_headers()
                self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            resp_body = e.read()
            print(f"  ← Status: {e.code}")
            print(f"  ← Body:   {resp_body.decode('utf-8', errors='replace')}\n")
            self.send_response(e.code)
            ct = e.headers.get("Content-Type", "application/json")
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(resp_body)))
            self.add_cors_headers()
            self.end_headers()
            self.wfile.write(resp_body)

        except urllib.error.URLError as e:
            error_msg = json.dumps({"message": f"Ошибка подключения к серверу: {e.reason}"}).encode()
            print(f"  ← URLError: {e.reason}\n")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(error_msg)))
            self.add_cors_headers()
            self.end_headers()
            self.wfile.write(error_msg)

    def log_message(self, fmt, *args):
        print(f"[сервер] {self.address_string()} — {fmt % args}")


if __name__ == "__main__":
    os.chdir(STATIC_DIR)
    print(f"✅ Прокси-сервер запущен: http://localhost:{PORT}")
    print(f"   Статика: {STATIC_DIR}")
    print(f"   Бэкенд:  {BACKEND}")
    print(f"\n   Открой в браузере: http://localhost:{PORT}/aut.html\n")
    print("   Для остановки нажми Ctrl+C\n")
    with http.server.ThreadingHTTPServer(("", PORT), ProxyHandler) as httpd:
        httpd.serve_forever()
