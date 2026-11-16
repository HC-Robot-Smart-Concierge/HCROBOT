from typing import Optional
from pydantic import BaseModel, Field


class ErrorResponseSchema(BaseModel):
    """Schema mô tả cấu trúc phản hồi lỗi chuẩn của HCROBOT trên Swagger UI."""
    status: str = Field(default="error", description="Trạng thái phản hồi (error)", json_schema_extra={"example": "error"})
    error_code: str = Field(default="BAD_REQUEST", description="Mã lỗi kỹ thuật", json_schema_extra={"example": "BAD_REQUEST"})
    message: str = Field(default="Yêu cầu không hợp lệ hoặc sai tham số.", description="Thông điệp lỗi chi tiết", json_schema_extra={"example": "Yêu cầu không hợp lệ hoặc sai tham số."})
    correlation_id: Optional[str] = Field(default=None, description="Mã truy vết toàn trình (Correlation ID)", json_schema_extra={"example": "SR-20261019-8421"})
    request_id: Optional[str] = Field(default=None, description="Mã định danh HTTP Request", json_schema_extra={"example": "req-9b87c71e220a"})
    timestamp: Optional[str] = Field(default=None, description="Thời điểm phát sinh lỗi (ISO 8601)", json_schema_extra={"example": "2026-10-19T08:30:00Z"})


class UnauthorizedResponseSchema(ErrorResponseSchema):
    """Lỗi 401 - Chưa xác thực hoặc Token không hợp lệ."""
    error_code: str = Field(default="UNAUTHORIZED", json_schema_extra={"example": "UNAUTHORIZED"})
    message: str = Field(default="Chưa đăng nhập hoặc phiên làm việc đã hết hạn.", json_schema_extra={"example": "Chưa đăng nhập hoặc token đã hết hạn."})


class ForbiddenResponseSchema(ErrorResponseSchema):
    """Lỗi 403 - Không đủ quyền hạn truy cập."""
    error_code: str = Field(default="FORBIDDEN", json_schema_extra={"example": "FORBIDDEN"})
    message: str = Field(default="Bạn không có quyền truy cập vào chức năng này.", json_schema_extra={"example": "Không đủ quyền truy cập tài nguyên."})


class NotFoundResponseSchema(ErrorResponseSchema):
    """Lỗi 404 - Không tìm thấy dữ liệu theo ID/tài nguyên."""
    error_code: str = Field(default="NOT_FOUND", json_schema_extra={"example": "NOT_FOUND"})
    message: str = Field(default="Không tìm thấy tài nguyên yêu cầu.", json_schema_extra={"example": "Không tìm thấy thông tin tương ứng trong hệ thống."})


class InternalServerErrorSchema(ErrorResponseSchema):
    """Lỗi 500 - Lỗi máy chủ nội bộ."""
    error_code: str = Field(default="INTERNAL_SERVER_ERROR", json_schema_extra={"example": "INTERNAL_SERVER_ERROR"})
    message: str = Field(default="Đã xảy ra sự cố nội bộ trên máy chủ. Vui lòng liên hệ quản trị viên.", json_schema_extra={"example": "Đã xảy ra sự cố nội bộ trên máy chủ."})


# ---------------------------------------------------------------------------
# CÁC BỘ PRESETS STATUS CODES CHUẨN ĐỂ ÁP DỤNG ĐÚNG NGỮ CẢNH
# ---------------------------------------------------------------------------

# 1. Cấp Toàn cục (Global): Chỉ khai báo lỗi 500 do GlobalExceptionMiddleware quản lý
GLOBAL_RESPONSES = {
    500: {
        "model": InternalServerErrorSchema,
        "description": "Lỗi máy chủ nội bộ không mong muốn (Internal Server Error)",
    },
}

# 2. Cấp Xác thực (Dành cho các router/endpoint có kiểm tra JWT Token & Phân quyền)
AUTH_RESPONSES = {
    401: {
        "model": UnauthorizedResponseSchema,
        "description": "Chưa xác thực hoặc Token hết hạn (Unauthorized)",
    },
    403: {
        "model": ForbiddenResponseSchema,
        "description": "Không có quyền truy cập tài nguyên (Forbidden)",
    },
}

# 3. Cấp Nghiệp vụ (Dành cho các endpoint xử lý dữ liệu có điều kiện)
BUSINESS_ERROR_RESPONSES = {
    400: {
        "model": ErrorResponseSchema,
        "description": "Yêu cầu không hợp lệ / Sai dữ liệu nghiệp vụ (Bad Request)",
    },
}

# 4. Cấp Tra cứu theo ID (Dành cho các endpoint GET/PUT/DELETE theo {id})
NOT_FOUND_RESPONSES = {
    404: {
        "model": NotFoundResponseSchema,
        "description": "Không tìm thấy tài nguyên theo định danh yêu cầu (Not Found)",
    },
}

# Tổng hợp tiện ích cho các CRUD Route có xác thực (400, 401, 403, 404)
SECURED_CRUD_RESPONSES = {
    **AUTH_RESPONSES,
    **BUSINESS_ERROR_RESPONSES,
    **NOT_FOUND_RESPONSES,
}


def setup_openapi_response_schemas(app) -> None:
    """
    Tự động chuẩn hóa tài liệu OpenAPI / Swagger UI:
    Đảm bảo mọi mã trạng thái (400, 401, 403, 404, 500) trên mọi endpoint luôn có đầy đủ
    cấu trúc JSON Schema, Media Type (application/json) và Example Value,
    kể cả khi endpoint chỉ ghi mô tả (description) đơn thuần mà quên chỉ định 'model'.
    """
    from fastapi.openapi.utils import get_openapi

    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema

        schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            description=app.description,
            routes=app.routes,
            tags=app.openapi_tags,
        )

        if "components" not in schema:
            schema["components"] = {}
        if "schemas" not in schema["components"]:
            schema["components"]["schemas"] = {}

        schema_map = {
            "400": ("ErrorResponseSchema", ErrorResponseSchema.model_json_schema()),
            "401": ("UnauthorizedResponseSchema", UnauthorizedResponseSchema.model_json_schema()),
            "403": ("ForbiddenResponseSchema", ForbiddenResponseSchema.model_json_schema()),
            "404": ("NotFoundResponseSchema", NotFoundResponseSchema.model_json_schema()),
            "500": ("InternalServerErrorSchema", InternalServerErrorSchema.model_json_schema()),
        }

        # 1. Đăng ký các Model Schema chuẩn vào components.schemas
        for code, (schema_name, json_schema) in schema_map.items():
            if schema_name not in schema["components"]["schemas"]:
                schema["components"]["schemas"][schema_name] = json_schema

        # 2. Quét qua toàn bộ các endpoint: Nếu có status code nhưng thiếu 'content', tự động gắn Schema tương ứng
        for path_item in schema.get("paths", {}).values():
            for operation in path_item.values():
                if isinstance(operation, dict) and "responses" in operation:
                    for status_code, (schema_name, _) in schema_map.items():
                        if status_code in operation["responses"]:
                            resp = operation["responses"][status_code]
                            if "content" not in resp:
                                resp["content"] = {
                                    "application/json": {
                                        "schema": {"$ref": f"#/components/schemas/{schema_name}"}
                                    }
                                }

        app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = custom_openapi
