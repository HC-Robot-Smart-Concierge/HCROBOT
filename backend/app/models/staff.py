from app.models.account import Account

# Backward compatibility alias: Staff is an alias to Account
Staff = Account

__all__ = ["Staff", "Account"]
