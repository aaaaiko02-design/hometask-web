"""
帰宅タスク サーバー
- 静的ファイル（HTML/CSS/JS）を配信
- /api/dayshift : dayshift-cache.json を読んで今日の日勤状態を返す
  （キャッシュは毎朝のスケジュールタスクが書き込む）
"""

import os
import json
from datetime import date
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(BASE_DIR, 'dayshift-cache.json')
PORT       = 3000


def read_dayshift_cache():
    try:
        with open(CACHE_FILE) as f:
            return json.load(f)
    except Exception:
        return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/dayshift':
            cache = read_dayshift_cache()

            if cache is None or cache.get('date') != date.today().isoformat():
                self._json(200, {'isDayShift': False, 'stale': True})
                return

            self._json(200, {
                'isDayShift': bool(cache.get('isDayShift', False)),
                'events': cache.get('events', [])
            })
            return

        super().do_GET()

    def _json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    os.chdir(BASE_DIR)
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'🌸 帰宅タスク サーバー起動 → http://localhost:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n停止しました')
