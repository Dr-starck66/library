"""HTTP integration and negative controls for the ASTRA public research preview."""
import json, unittest, threading, http.client, tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
import app

class PublicApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token='only-test-token-absolutely-not-real-123'
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),app.build_handler(cls.token))
        cls.t=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.t.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.t.join(5)

    def get(self,url,auth=None,method='GET'):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        headers={'Authorization':'Bearer '+auth} if auth else {}
        c.request(method,url,headers=headers)
        r=c.getresponse()
        data=(r.status,dict(r.getheaders()),r.read())
        c.close()
        return data

    def test_public_health_is_honest(self):
        s,h,b=self.get('/healthz')
        v=json.loads(b)
        self.assertEqual(s,200)
        self.assertFalse(v['scientific_independent_validation'])
        self.assertFalse(v['live_forecasts'])

    def test_public_landing(self):
        s,h,b=self.get('/')
        self.assertEqual(s,200)
        self.assertIn(b'ASTRA',b)
        self.assertIn(b'23/38',b)
        self.assertIn('Strict-Transport-Security',h)

    def test_auth_default_denied(self):
        self.assertEqual(self.get('/v1/audit')[0],401)

    def test_wrong_token_denied(self):
        self.assertEqual(self.get('/v1/audit','123')[0],401)

    def test_authorized_audit_real_negative(self):
        s,h,b=self.get('/v1/audit',self.token)
        v=json.loads(b)
        self.assertEqual(s,200)
        self.assertEqual(v['study']['observations'],38)
        self.assertLess(v['study']['model_accuracy'],v['study']['baseline_accuracy'])

    def test_catalog_30(self):
        s,h,b=self.get('/v1/catalog',self.token)
        self.assertEqual(s,200)
        self.assertEqual(json.loads(b)['count'],30)

    def test_only_aggregate_csv(self):
        s,h,b=self.get('/v1/summary.csv',self.token)
        self.assertEqual(s,200)
        self.assertIn(b'model_accuracy',b)
        self.assertNotIn(b'2024-01-05',b)

    def test_query_denied(self):
        self.assertEqual(self.get('/?secret=notgood')[0],400)

    def test_no_writes(self):
        for method in ('POST','PUT','PATCH','DELETE'):
            self.assertEqual(self.get('/v1/audit',self.token,method)[0],405)

    def test_missing_secret_failure(self):
        with self.assertRaises(ValueError):
            app.build_handler('')

    def test_registry_bad_state_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/'index.html').write_bytes((app.BASE/'index.html').read_bytes())
            (root/'audit_receipt_public.json').write_bytes((app.BASE/'audit_receipt_public.json').read_bytes())
            (root/'macro_catalog_public.json').write_text('{"series":[]}')
            with self.assertRaises(ValueError):
                app.build_handler(self.token,root)

if __name__=='__main__':
    unittest.main()
