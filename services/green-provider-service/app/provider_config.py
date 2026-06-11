PROVIDER_CODE = "greenPlug"
SERVICE_NAME_DEFAULT = "green-provider-service"
DATABASE_URL_DEFAULT = "postgresql://saasplug:saasplug@green-provider-postgres:5432/green_provider"
BASE_URL_ENV = "GREEN_PROVIDER_BASE_URL"
BASE_URL_DEFAULT = "https://davinci.softlab.ntua.gr/saas26/greenPlug/api"
API_KEY_ENV_VAR_DEFAULT = "GREEN_PROVIDER_API_KEY"

LIST_PATH = "/chargingPoints"
DETAIL_PATH_TEMPLATE = "/chargingPoints/{pointid}"
STATUS_PATH_TEMPLATE = "/chargingPoints/{pointid}"
RESERVE_PATH_TEMPLATE = "/chargingPoints/{pointid}/reservations"
RESERVE_STRATEGY = "green_json_duration"

POINT_ID_FIELD = "id"
STATUS_FIELD = "state"
RESERVATION_END_FIELD = "reservedUntil"
PRICE_FIELD = "kwhRateEur"
RESERVATION_ID_FIELD = None
