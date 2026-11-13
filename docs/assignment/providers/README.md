# Provider API reference provenance

The hypothetical `redPlug`, `greenPlug`, and `bluePlug` APIs originate from the
NTUA Software-as-a-Service Technologies course. Supplied OpenAPI YAML, provider
Postman collections, and the course API-description PDF are omitted pending an
applicable redistribution grant. Original copies remain in private evidence.

Authorized course users can consult the original
[Swagger reference](swagger_apis_hypothetical_providers.md); access requires the
NTUA course network/VPN and authorized credentials.

The public application retains its original provider adapters under
`services/red-provider-service/`, `services/green-provider-service/`, and
`services/blue-provider-service/`, including their DTOs and mocked tests.
The separate local application collections under `docs/postman/` are retained.
They target saasPlug itself and do not replace the omitted provider references.
No adapter imports the omitted YAML/Postman/PDF files at runtime.

See [material rights](../../material-rights.md) and
[material provenance](../../material-provenance.json) for the scope and remaining
history-clearance requirement. No provider was contacted or modified during
publication preparation.
