from app.models.support_request import SupportRequest

# Backward compatibility alias: ReceptionRequest is an alias to SupportRequest
ReceptionRequest = SupportRequest

__all__ = ["ReceptionRequest", "SupportRequest"]
