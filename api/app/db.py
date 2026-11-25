
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from api.app.config import settings


DATABASE_URL = settings.DATABASE_URL

# Support older PostgreSQL URL formats.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )


connect_args = {}

engine_options = {
    "echo": False,
    "future": True,
}

if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    engine_options["connect_args"] = connect_args

    engine_options["echo"] = False

else:
    # Keep the connection pool small for serverless instances.
    engine_options.update(
        {
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "pool_size": 2,
            "max_overflow": 0,
            "pool_timeout": 30,
        }
    )


engine = create_engine(
    DATABASE_URL,
    **engine_options,
)


# Enable SQLite-specific settings for local development.
if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()

        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")

        cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
