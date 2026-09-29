from app.models.support_request import SupportRequest

# Backward compatibility alias: HousekeepingRequest is an alias to SupportRequest
HousekeepingRequest = SupportRequest

__all__ = ["HousekeepingRequest", "SupportRequest"]
