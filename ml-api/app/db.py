from contextlib import contextmanager
from typing import Generator
from psycopg_pool import ConnectionPool
from psycopg import Connection
from app.config import settings

pool: ConnectionPool | None = None


def init_pool() -> ConnectionPool:
    global pool
    if pool is None:
        p = ConnectionPool(
            conninfo=settings.DATABASE_URL,
            min_size=2,
            max_size=20,
            kwargs={"autocommit": True},
        )
        p.open()
        pool = p
    return pool


def close_pool() -> None:
    global pool
    if pool is not None:
        pool.close()
        pool = None


@contextmanager
def get_db_connection() -> Generator[Connection, None, None]:
    p = pool
    if p is None:
        p = init_pool()
    with p.connection() as conn:
        yield conn
