from app.models.support_request import SupportRequest

# Backward compatibility alias: BellRequest is an alias to SupportRequest
BellRequest = SupportRequest

__all__ = ["BellRequest", "SupportRequest"]
