PROVIDER_CODE = "redPlug"
SERVICE_NAME_DEFAULT = "red-provider-service"
DATABASE_URL_DEFAULT = "postgresql://saasplug:saasplug@red-provider-postgres:5432/red_provider"
BASE_URL_ENV = "RED_PROVIDER_BASE_URL"
BASE_URL_DEFAULT = "https://davinci.softlab.ntua.gr/saas26/redPlug/api"
API_KEY_ENV_VAR_DEFAULT = "RED_PROVIDER_API_KEY"

LIST_PATH = "/points"
DETAIL_PATH_TEMPLATE = "/point/{pointid}"
STATUS_PATH_TEMPLATE = "/point/{pointid}"
RESERVE_DEFAULT_PATH_TEMPLATE = "/reserve/{pointid}"
RESERVE_WITH_DURATION_PATH_TEMPLATE = "/reserve/{pointid}/{minutes}"
RESERVE_STRATEGY = "red_path_duration"

POINT_ID_FIELD = "pointid"
STATUS_FIELD = "status"
RESERVATION_END_FIELD = "reservationendtime"
PRICE_FIELD = None
RESERVATION_ID_FIELD = None
