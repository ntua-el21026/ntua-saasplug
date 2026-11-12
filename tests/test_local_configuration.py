"""Offline configuration checks. No environment values are printed on failure."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def env_fields(path):
    result = {}
    for line in path.read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            name, value = line.split('=', 1)
            result[name] = value
    return result


class LocalConfigurationTests(unittest.TestCase):
    def test_both_templates_contain_only_placeholders_for_private_auth_values(self):
        for template in ('.env.example', '.env.example.correct'):
            fields = env_fields(ROOT / template)
            for name in ('JWT_SECRET', 'DEMO_USER_PASSWORD', 'GOOGLE_CLIENT_SECRET', 'SCHEDULER_INTERNAL_TOKEN'):
                value = fields.get(name, '')
                safe = not value or value.lower().startswith(('change-me', 'replace-me'))
                self.assertTrue(safe, f'{template}: {name} must be a placeholder')

    def test_gateway_defaults_to_loopback(self):
        compose = (ROOT / 'docker-compose.yml').read_text()
        self.assertTrue('127.0.0.1:${GATEWAY_HTTP_PORT:-8080}:80' in compose,
                        'Local gateway must default to a loopback binding')

    def test_safe_template_requires_explicit_background_provider_activity(self):
        fields = env_fields(ROOT / '.env.example')
        self.assertIn('SCHEDULER_RUN_LOOP:-false', (ROOT / 'docker-compose.yml').read_text())
        for name in ('SCHEDULER_RUN_LOOP', 'CATALOG_IMPORT_ON_STARTUP'):
            self.assertTrue(fields.get(name) == 'false', f'{name} must default to false in the template')


if __name__ == '__main__':
    unittest.main()
