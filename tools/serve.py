"""Local preview server that mimics Netlify pretty URLs: /about -> about.html"""
import http.server, os, sys, functools
ROOT = os.path.join(os.path.dirname(__file__), '..', 'dist')
class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        p = self.path.split('?')[0].split('#')[0]
        full = os.path.join(ROOT, p.lstrip('/'))
        if p != '/' and not os.path.splitext(p)[1] and os.path.exists(full.rstrip('/') + '.html'):
            self.path = p.rstrip('/') + '.html'
        elif not os.path.exists(full) and not p.endswith('/'):
            self.path = '/404.html'
        return super().send_head()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=ROOT)).serve_forever()
