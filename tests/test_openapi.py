import unittest

import app
from openapi_spec import build_openapi_spec


class OpenApiTests(unittest.TestCase):
    def test_spec_documents_every_api_route_and_method(self):
        spec = build_openapi_spec()
        documented = spec["paths"]

        self.assertEqual(spec["openapi"], "3.1.1")
        for rule in app.app.url_map.iter_rules():
            if not rule.rule.startswith("/api/") or rule.rule in {"/api/openapi.json", "/api/docs"}:
                continue
            actual_methods = {method.lower() for method in rule.methods if method not in {"HEAD", "OPTIONS"}}
            self.assertIn(rule.rule, documented)
            self.assertEqual(actual_methods, actual_methods.intersection(documented[rule.rule]))
        self.assertIn("bearerAuth", spec["components"]["securitySchemes"])
        self.assertIn("cookieAuth", spec["components"]["securitySchemes"])

    def test_docs_and_json_are_served_with_local_assets(self):
        with app.app.test_client() as client:
            spec_response = client.get("/api/openapi.json")
            docs_response = client.get("/api/docs")

        self.assertEqual(spec_response.status_code, 200)
        self.assertEqual(spec_response.get_json()["info"]["title"], "Career Tracker API")
        self.assertEqual(docs_response.status_code, 200)
        html = docs_response.get_data(as_text=True)
        self.assertIn("/swagger-ui/swagger-ui-bundle.js", html)
        self.assertIn("/api/openapi.json", html)
        self.assertNotIn("unpkg.com", html)
        self.assertIn("Content-Security-Policy", docs_response.headers)


if __name__ == "__main__":
    unittest.main()
