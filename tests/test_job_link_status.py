import unittest
from unittest.mock import patch

import app


class FakeResponse:
    def __init__(self, status_code=200, body="", headers=None):
        self.status_code = status_code
        self._body = body.encode("utf-8")
        self.headers = headers or {"content-type": "text/html; charset=utf-8"}
        self.encoding = "utf-8"
        self.is_redirect = False

    def iter_content(self, chunk_size=8192, decode_unicode=False):
        yield self._body


class JobLinkStatusTests(unittest.TestCase):
    def setUp(self):
        app.link_status_cache.clear()

    def test_rejects_private_or_local_link_without_fetching(self):
        with patch("app.requests.get") as request_get:
            result = app.get_job_link_status("http://127.0.0.1:8794/api/health")

        self.assertEqual(result["status"], "invalid")
        self.assertFalse(result["ok"])
        request_get.assert_not_called()

    def test_marks_ashby_job_not_found_as_unavailable(self):
        with patch("app.hostname_is_public", return_value=True), patch(
            "app.requests.get",
            return_value=FakeResponse(body="<h1>Job not found</h1><p>The job you requested was not found.</p>"),
        ):
            result = app.get_job_link_status("https://jobs.ashbyhq.com/giga/example")

        self.assertEqual(result["status"], "unavailable")
        self.assertFalse(result["ok"])
        self.assertTrue(result["checked"])
        self.assertIn("no longer available", result["message"])

    def test_unknown_hosts_are_not_blocked(self):
        with patch("app.hostname_is_public", return_value=True), patch("app.requests.get") as request_get:
            result = app.get_job_link_status("https://example.com/jobs/123")

        self.assertEqual(result["status"], "unchecked")
        self.assertTrue(result["ok"])
        request_get.assert_not_called()


if __name__ == "__main__":
    unittest.main()
