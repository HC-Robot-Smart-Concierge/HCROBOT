from app.models.support_request import SupportRequest

# Backward compatibility alias: MaintenanceRequest is an alias to SupportRequest
MaintenanceRequest = SupportRequest

__all__ = ["MaintenanceRequest", "SupportRequest"]
