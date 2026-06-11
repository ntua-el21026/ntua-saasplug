from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import User
from app.schemas import Role
from app.security import hash_password, normalize_email


def provider_id_for(provider_code: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"https://saasplug.local/providers/{provider_code}"))


DEMO_USERS = (
    {
        "email": "operator@saasplug.local",
        "role": Role.OPERATOR,
        "provider_code": None,
    },
    {
        "email": "evuser@saasplug.local",
        "role": Role.EV_USER,
        "provider_code": None,
    },
    {
        "email": "red-admin@saasplug.local",
        "role": Role.PROVIDER_ADMIN,
        "provider_code": "redPlug",
    },
    {
        "email": "green-admin@saasplug.local",
        "role": Role.PROVIDER_ADMIN,
        "provider_code": "greenPlug",
    },
    {
        "email": "blue-admin@saasplug.local",
        "role": Role.PROVIDER_ADMIN,
        "provider_code": "bluePlug",
    },
)


def seed_demo_users(db: Session, settings: Settings) -> None:
    demo_password_hash = hash_password(settings.demo_user_password)

    for seed_user in DEMO_USERS:
        email = normalize_email(seed_user["email"])
        provider_code = seed_user["provider_code"]
        provider_id = provider_id_for(provider_code) if provider_code else None
        role = seed_user["role"].value

        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            db.add(
                User(
                    email=email,
                    password_hash=demo_password_hash,
                    roles=[role],
                    provider_id=provider_id,
                    provider_code=provider_code,
                    is_active=True,
                ),
            )
            continue

        user.password_hash = demo_password_hash
        user.roles = [role]
        user.provider_id = provider_id
        user.provider_code = provider_code
        user.is_active = True

    db.commit()
