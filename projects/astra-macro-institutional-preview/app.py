#!/usr/bin/env python3
"""ASTRA MACRO Ω — public sanitized read-only institutional preview.

Distribution shell only. No private predictor, private data, prospect database,
or trading functionality is deployed. This service is not a scientific audit.
"""
from __future__ import annotations
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

BASE = Path(__file__).resolve().parent


def build_handler(token: str, base=BASE):
    if not isinstance(token, str) or len(token) < 32 or not token.isascii() or any(ord(x) < 33 for x in token):
        raise ValueError('ASTRA_PILOT_TOKEN missing or invalid')
    registry = json.loads((base / 'macro_catalog_public.json').read_text(encoding='utf-8'))
    audit = json.loads((base / 'audit_receipt_public.json').read_text(encoding='utf-8'))
    html = (base / 'index.html').read_bytes()
    if len(registry.get('series', [])) != 30 or audit.get('metric_scope') != 'EXPLORATORY_RESEARCH':
        raise ValueError('unexpected public evidence package')
    if audit.get('study', {}).get('model_correct') != 23 or audit['study'].get('baseline_correct') != 27:
        raise ValueError('baseline audit tampering / unexpected revision')
    if not html[:20].lower().startswith(b'<!doctype html>'):
        raise ValueError('invalid intro')

    def payload(value):
        return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False) + '\n').encode('utf-8')

    class Handler(BaseHTTPRequestHandler):
        server_version = 'ASTRA-Research-Preview'
        sys_version = ''

        def log_message(self, fmt, *args):
            pass  # No Authorization/request URL logging

        def send_payload(self, status, data, content_type='application/json; charset=utf-8'):
            self.send_response(status)
            for name, value in (
                ('Content-Type', content_type), ('Content-Length', str(len(data))),
                ('Cache-Control','no-store'), ('X-Content-Type-Options','nosniff'),
                ('X-Frame-Options','DENY'), ('Referrer-Policy','no-referrer'),
                ('Strict-Transport-Security','max-age=31536000; includeSubDomains'),
            ):
                self.send_header(name, value)
            if content_type.startswith('text/html'):
                self.send_header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            url=urlsplit(self.path)
            if url.query or url.fragment:
                return self.send_payload(400,payload({'error':'QUERY_PARAMETERS_DISABLED'}))
            if url.path in ('/', '/index.html'):
                return self.send_payload(200,html,'text/html; charset=utf-8')
            if url.path=='/healthz':
                return self.send_payload(200,payload({'status':'PREVIEW_ONLY', 'cost_tier':'RENDER_FREE',
                                                      'scientific_independent_validation':False,
                                                      'live_forecasts':False, 'no_trading':True}))
            if not hmac.compare_digest(self.headers.get('Authorization',''), 'Bearer '+token):
                return self.send_payload(401,payload({'error':'UNAUTHORIZED'}))
            if url.path=='/v1/audit':
                return self.send_payload(200,payload(audit))
            if url.path=='/v1/catalog':
                return self.send_payload(200,payload({'series': registry['series'], 'count':30,
                                                     'data_availability':'REGISTRY_ONLY_NOT_LIVE'}))
            if url.path=='/v1/summary.csv':
                s=audit['study']
                rows=['metric,value', 'observations,'+str(s['observations']),
                      'model_correct,'+str(s['model_correct']), 'baseline_correct,'+str(s['baseline_correct']),
                      'model_accuracy,'+str(s['model_accuracy']), 'baseline_accuracy,'+str(s['baseline_accuracy'])]
                return self.send_payload(200,('\n'.join(rows)+'\n').encode('ascii'),'text/csv; charset=utf-8')
            return self.send_payload(404,payload({'error':'NOT_FOUND'}))

        def do_POST(self):
            return self.send_payload(405,payload({'error':'READ_ONLY'}))
        do_PUT=do_POST
        do_PATCH=do_POST
        do_DELETE=do_POST

    return Handler


def main():
    secret = os.getenv('ASTRA_PILOT_TOKEN', '')
    port = int(os.getenv('PORT','10000'))
    if not 1 <= port <= 65535:
        raise ValueError('invalid PORT')
    handler=build_handler(secret)
    with ThreadingHTTPServer(('0.0.0.0',port),handler) as server:
        print(json.dumps({'status':'RESEARCH_PREVIEW_RUNNING','port':port}),flush=True)
        server.serve_forever()

if __name__=='__main__':
    main()
