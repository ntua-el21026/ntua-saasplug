PROVIDER_CODE = "bluePlug"
SERVICE_NAME_DEFAULT = "blue-provider-service"
DATABASE_URL_DEFAULT = "postgresql://saasplug:saasplug@blue-provider-postgres:5432/blue_provider"
BASE_URL_ENV = "BLUE_PROVIDER_BASE_URL"
BASE_URL_DEFAULT = "https://davinci.softlab.ntua.gr/saas26/bluePlug/api"
API_KEY_ENV_VAR_DEFAULT = "BLUE_PROVIDER_API_KEY"

LIST_PATH = "/locations"
DETAIL_PATH_TEMPLATE = "/location/{pointid}/status"
STATUS_PATH_TEMPLATE = "/location/{pointid}/status"
RESERVE_PATH_TEMPLATE = "/location/{pointid}/hold"
RESERVE_STRATEGY = "blue_query_minutes"

POINT_ID_FIELD = "chargerId"
STATUS_FIELD = "currentStatus"
RESERVATION_END_FIELD = "reservationEnd"
PRICE_FIELD = "pricePerKwh"
RESERVATION_ID_FIELD = None
