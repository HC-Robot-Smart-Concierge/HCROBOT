import time
import logging
from typing import Callable
from fastapi import Request, Response
from fastapi.routing import APIRoute

logger = logging.getLogger("hcrobot.interceptor.route")


class RouteInterceptor(APIRoute):
    """
    Route-level Interceptor (Kế thừa APIRoute trong FastAPI).
    
    Khác với Middleware chạy ở tầng ASGI tổng thể, Interceptor này can thiệp trực tiếp 
    vào chu kỳ thực thi của chính hàm Controller/Endpoint:
    1. Pre-handle: Ghi nhận tên endpoint, route path, thời điểm bắt đầu xử lý logic nghiệp vụ.
    2. Post-handle: Đo thời gian thực thi thuần túy của hàm (Handler Time - loại bỏ overhead mạng),
       gắn header 'X-Handler-Time', và có thể biến đổi kết quả trả về.
    3. Exception-handle: Bắt và ghi nhận lỗi nghiệp vụ cụ thể gắn với tên endpoint.
    """

    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def intercepted_route_handler(request: Request) -> Response:
            # 1. Pre-handle
            endpoint_name = self.endpoint.__name__
            request.state.endpoint_name = endpoint_name
            request.state.route_path = self.path
            
            start_time = time.perf_counter()

            try:
                # 2. Thực thi Route Handler gốc
                response: Response = await original_route_handler(request)

                # 3. Post-handle
                handler_duration_ms = (time.perf_counter() - start_time) * 1000
                response.headers["X-Handler-Time"] = f"{handler_duration_ms:.2f}ms"
                response.headers["X-Endpoint"] = endpoint_name

                # Ghi log debug cho từng handler nếu cần
                logger.debug(
                    f"[ROUTE_INTERCEPTOR] Endpoint '{endpoint_name}' ({self.path}) executed in {handler_duration_ms:.2f}ms"
                )

                return response

            except Exception as exc:
                # 4. Exception-handle
                handler_duration_ms = (time.perf_counter() - start_time) * 1000
                logger.warning(
                    f"[ROUTE_INTERCEPTOR] Endpoint '{endpoint_name}' failed after {handler_duration_ms:.2f}ms: {exc}"
                )
                raise exc

        return intercepted_route_handler
