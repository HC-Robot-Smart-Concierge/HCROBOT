import functools
import inspect
import time
import logging
from typing import Callable, Optional, Any

from app.services.logger_service import audit, log_event, LogLevelEnum, LogCategoryEnum

logger = logging.getLogger("hcrobot.interceptor.aop")


def audit_action(
    action: str,
    resource_type: str,
    resource_id_arg: Optional[str] = None,
    default_actor_id: str = "system",
):
    """
    AOP Method Interceptor: Tự động ghi Audit Trail cho một hàm/endpoint.
    
    Khi hàm được thực thi thành công, Interceptor này sẽ tự động:
    - Trích xuất resource_id từ tham số của hàm (nếu resource_id_arg được cấu hình).
    - Lấy Correlation ID hiện tại từ async contextvars.
    - Ghi nhận vào bảng AuditLog và hệ thống Logging của HCROBOT.
    """
    def decorator(func: Callable):
        sig = inspect.signature(func)

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 1. Pre-handle: Trích xuất tham số
            bound_args = sig.bind_partial(*args, **kwargs)
            bound_args.apply_defaults()
            
            res_id = None
            if resource_id_arg and resource_id_arg in bound_args.arguments:
                val = bound_args.arguments[resource_id_arg]
                res_id = getattr(val, "id", str(val))

            actor_id = default_actor_id
            if "current_user" in bound_args.arguments:
                user = bound_args.arguments["current_user"]
                actor_id = getattr(user, "username", getattr(user, "id", default_actor_id))

            # 2. Thực thi hàm gốc
            result = await func(*args, **kwargs)

            # 3. Post-handle: Ghi Audit Log tự động
            try:
                audit(
                    action=action,
                    resource_type=resource_type,
                    resource_id=res_id,
                    actor_id=str(actor_id),
                )
            except Exception as e:
                logger.warning(f"[AUDIT_INTERCEPTOR_ERROR] Không thể tự động ghi audit log: {e}")

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            bound_args = sig.bind_partial(*args, **kwargs)
            bound_args.apply_defaults()
            
            res_id = None
            if resource_id_arg and resource_id_arg in bound_args.arguments:
                val = bound_args.arguments[resource_id_arg]
                res_id = getattr(val, "id", str(val))

            actor_id = default_actor_id
            if "current_user" in bound_args.arguments:
                user = bound_args.arguments["current_user"]
                actor_id = getattr(user, "username", getattr(user, "id", default_actor_id))

            result = func(*args, **kwargs)

            try:
                audit(
                    action=action,
                    resource_type=resource_type,
                    resource_id=res_id,
                    actor_id=str(actor_id),
                )
            except Exception as e:
                logger.warning(f"[AUDIT_INTERCEPTOR_ERROR] Không thể tự động ghi audit log: {e}")

            return result

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


def measure_performance(
    action_name: Optional[str] = None,
    slow_threshold_ms: float = 1000.0,
):
    """
    Performance Interceptor: Giám sát và cảnh báo các tác vụ AI / SLAM / Robot chạy chậm.
    
    Tự động ghi log cảnh báo (WARNING) khi hàm mất nhiều hơn slow_threshold_ms để xử lý,
    giúp đội ngũ kỹ thuật nhanh chóng phát hiện điểm nghẽn (bottleneck).
    """
    def decorator(func: Callable):
        name = action_name or func.__name__

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                return await func(*args, **kwargs)
            finally:
                duration_ms = (time.perf_counter() - start) * 1000
                if duration_ms > slow_threshold_ms:
                    logger.warning(
                        f"[SLOW_EXECUTION_ALERT] Tác vụ '{name}' mất {duration_ms:.2f}ms (Ngưỡng cảnh báo: {slow_threshold_ms}ms)!"
                    )
                else:
                    logger.debug(f"[PERF_INTERCEPTOR] '{name}' hoàn tất trong {duration_ms:.2f}ms")

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                duration_ms = (time.perf_counter() - start) * 1000
                if duration_ms > slow_threshold_ms:
                    logger.warning(
                        f"[SLOW_EXECUTION_ALERT] Tác vụ '{name}' mất {duration_ms:.2f}ms (Ngưỡng cảnh báo: {slow_threshold_ms}ms)!"
                    )
                else:
                    logger.debug(f"[PERF_INTERCEPTOR] '{name}' hoàn tất trong {duration_ms:.2f}ms")

        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
