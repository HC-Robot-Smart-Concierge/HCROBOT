from app.core.database import connection_pool_limits


def test_supabase_session_pool_fits_below_provider_client_limit():
    limits = connection_pool_limits('postgresql+asyncpg://user:pass@aws-0-test.pooler.supabase.com:5432/postgres')
    assert limits == {"pool_size": 3, "max_overflow": 2}
    assert sum(limits.values()) < 15


def test_transaction_pooler_and_direct_database_keep_existing_limits():
    for url in [
        'postgresql+asyncpg://user:pass@aws-0-test.pooler.supabase.com:6543/postgres',
        'postgresql+asyncpg://user:pass@localhost:5432/postgres',
    ]:
        assert connection_pool_limits(url) == {"pool_size": 10, "max_overflow": 10}
