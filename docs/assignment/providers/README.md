# Provider API Artifacts

This directory contains supporting API material for the hypothetical charging
point providers used by the saasPlug assignment.

## Contents

- `swagger_apis_hypothetical_providers.md` - link to the hosted Swagger UI for
  the provider APIs.
- `yaml/` - OpenAPI 3.1 YAML specifications for each provider.
- `postman_collections/` - Postman collections generated for manual API calls
  and exploratory testing.

## Providers

The assignment uses three provider-specific API contracts:

- `redPlug`
  - OpenAPI: `yaml/redPlug.yaml`
  - Postman: `postman_collections/redPlug.postman_collection.json`
  - Main endpoints: list points, get point details, reserve with default
    duration, reserve with explicit duration.
- `greenPlug`
  - OpenAPI: `yaml/greenPlug.yaml`
  - Postman: `postman_collections/greenPlug.postman_collection.json`
  - Main endpoints: list charging points, get one charging point, create a
    reservation with a JSON request body.
- `bluePlug`
  - OpenAPI: `yaml/bluePlug.yaml`
  - Postman: `postman_collections/bluePlug.postman_collection.json`
  - Main endpoints: list locations, get location status, hold a charger using a
    query parameter for duration.

## Hosted Swagger

The hosted Swagger UI is documented in
`swagger_apis_hypothetical_providers.md`:

```text
https://davinci.softlab.ntua.gr/saas26/swagger
```

The link requires NTUA VPN access.

## Usage Notes

These provider APIs are intentionally different. They represent the external
contracts that the saasPlug charging-points interface must normalize:

- Provider-specific base URLs are declared in each OpenAPI file.
- Equivalent business operations use different path names and response field
  names across providers.
- Reservation duration is passed differently by provider: path parameter,
  request body, or query parameter.

Use the YAML files as the source of truth for endpoint contracts. Use the
Postman collections for quick manual calls or for checking request examples.
