# Repository checks and gateway integration tests

`test_local_configuration.py` runs offline and checks that both environment
templates use placeholder auth secrets, the gateway binds to loopback, and
background provider activity requires explicit configuration.

```bash
python3 -m unittest discover -s tests -v
```

`test_gateway_contract.py` needs an already running, isolated Compose stack.
Those three tests are skipped by default; opt in deliberately:

```bash
SAASPLUG_RUN_GATEWAY_TESTS=1 python3 -m unittest discover -s tests -v
```

Set `SAASPLUG_GATEWAY_BASE_URL` only for a gateway you control. Integration tests
use gateway URLs and do not read `.env`. They must not target production/provider
systems. Service business-logic tests stay in `services/*/tests/`; frontend tests
are under `apps/frontend/src/test/`. A passed source/config check does not establish
container, PostgreSQL, RabbitMQ, provider, or deployment correctness.
