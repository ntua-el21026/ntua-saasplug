import os
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


GATEWAY_BASE_URL = os.getenv("SAASPLUG_GATEWAY_BASE_URL", "http://localhost:8080").rstrip("/")


def gateway_status(path: str, method: str = "GET") -> int:
    request = Request(f"{GATEWAY_BASE_URL}{path}", method=method)
    try:
        with urlopen(request, timeout=10) as response:
            return response.status
    except HTTPError as exc:
        return exc.code
    except URLError as exc:
        raise AssertionError(f"Gateway is not reachable at {GATEWAY_BASE_URL}") from exc


class GatewayContractTests(unittest.TestCase):
    def test_public_health_paths_are_available(self) -> None:
        expected_ok = [
            "/health",
            "/api/auth/health",
            "/api/providers/health",
            "/api/catalog/health",
            "/api/status/health",
            "/api/reservations/health",
            "/api/analytics/health",
            "/api/billing/health",
            "/api/scheduler/health",
        ]

        for path in expected_ok:
            with self.subTest(path=path):
                self.assertEqual(gateway_status(path), 200)

    def test_scheduler_operator_api_is_routed_but_requires_auth(self) -> None:
        expected_auth_required = [
            "/api/scheduler/jobs",
            "/api/scheduler/runs",
        ]

        for path in expected_auth_required:
            with self.subTest(path=path):
                self.assertEqual(gateway_status(path), 401)

    def test_service_internal_job_routes_are_not_exposed(self) -> None:
        expected_blocked = [
            "/api/catalog/internal/",
            "/api/catalog/internal/jobs/catalog/freshness",
            "/api/analytics/internal/",
            "/api/analytics/internal/jobs/freshness",
            "/api/billing/internal/",
            "/api/billing/internal/jobs/freshness",
            "/api/reservations/internal/",
            "/api/reservations/internal/jobs/freshness",
        ]

        for path in expected_blocked:
            with self.subTest(path=path):
                self.assertEqual(gateway_status(path), 404)


if __name__ == "__main__":
    unittest.main()
