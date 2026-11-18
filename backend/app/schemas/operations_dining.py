from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator


# ---------------------------------------------------------
# Restaurant Table Reservation & Pre-Order Schemas
# ---------------------------------------------------------
class RestaurantReservationCreate(BaseModel):
    guest_name: str
    room_number: Optional[str] = None
    party_size: int = 2
    reservation_time: str
    table_number: Optional[str] = "Table 01"
    special_note: Optional[str] = None

class RestaurantReservationResponse(BaseModel):
    id: str
    reservation_code: str
    guest_name: str
    room_number: Optional[str]
    party_size: int
    reservation_time: str
    table_number: Optional[str]
    special_note: Optional[str]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PreOrderItem(BaseModel):
    name: str
    quantity: int = 1
    price: float = 0.0

class RestaurantPreOrderCreate(BaseModel):
    guest_name: str
    room_number: Optional[str] = None
    reservation_code: Optional[str] = None
    items: List[PreOrderItem]
    total_price: float = 0.0
    note: Optional[str] = None

class RestaurantPreOrderResponse(BaseModel):
    id: str
    order_code: str
    reservation_code: Optional[str]
    guest_name: str
    room_number: Optional[str]
    items: List[Dict[str, Any]]
    total_price: float
    note: Optional[str]
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RestaurantDashboardResponse(BaseModel):
    kpis: Dict[str, Any]
    reservations: List[RestaurantReservationResponse]
    pre_orders: List[RestaurantPreOrderResponse]

# Aliases for Kitchen naming
KitchenReservationCreate = RestaurantReservationCreate
KitchenReservationResponse = RestaurantReservationResponse
KitchenPreOrderCreate = RestaurantPreOrderCreate
KitchenPreOrderResponse = RestaurantPreOrderResponse
KitchenDashboardResponse = RestaurantDashboardResponse


# ---------------------------------------------------------
# Food Item (Master Dish Catalog) & Menu Schemas (Diagram 2)
# ---------------------------------------------------------
class FoodItemCreate(BaseModel):
    name: str = Field(..., description="Tên món ăn hoặc thức uống")
    category: str = Field("Món chính", description="Phân loại: Khai vị, Món chính, Đồ uống, Tráng miệng, Ăn nhẹ")
    description: Optional[str] = Field(None, description="Mô tả món ăn, hương vị hoặc thành phần dị ứng")
    image_url: Optional[str] = Field(None, description="Đường dẫn ảnh món ăn")
    prep_time_minutes: int = Field(15, description="Thời gian chuẩn bị dự kiến của bếp (phút)")
    is_available: bool = Field(True, description="Bếp tổng có phục vụ món này không")


class FoodItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    is_available: Optional[bool] = None


class FoodItemResponse(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time_minutes: int
    is_available: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)



class MenuItemCreate(BaseModel):
    menu_id: str
    food_item_id: Optional[str] = None
    price: Optional[float] = None
    display_order: int = 0
    is_available: bool = True

    # Hỗ trợ tạo nhanh món chưa có trong catalog
    name: Optional[str] = None
    currency: Optional[str] = "VND"
    image_url: Optional[str] = None
    category: Optional[str] = "Món chính"
    description: Optional[str] = None


class MenuItemResponse(BaseModel):
    id: str
    menu_id: str
    food_item_id: Optional[str] = None
    price: float
    display_order: int = 0
    is_available: bool
    name: str = ""
    currency: str = "VND"
    image_url: Optional[str] = None
    category: str = "Món chính"
    description: Optional[str] = None
    food_item: Optional[FoodItemResponse] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def resolve_fields(cls, data: Any) -> Any:
        if hasattr(data, '__dict__'):
            fi = data.__dict__.get('food_item', None)
            name = getattr(data, 'name', None) or (getattr(fi, 'name', '') if fi else "")
            category = getattr(data, 'category', None) or (getattr(fi, 'category', 'Món chính') if fi else "Món chính")
            image_url = getattr(data, 'image_url', None) or (getattr(fi, 'image_url', None) if fi else None)
            description = getattr(data, 'description', None) or (getattr(fi, 'description', None) if fi else None)
            currency = getattr(data, 'currency', None) or (getattr(fi, 'currency', 'VND') if fi else "VND")
            return {
                "id": getattr(data, 'id', ''),
                "menu_id": getattr(data, 'menu_id', ''),
                "food_item_id": getattr(data, 'food_item_id', None),
                "price": getattr(data, 'price', 0.0),
                "display_order": getattr(data, 'display_order', 0) or 0,
                "is_available": getattr(data, 'is_available', True),
                "name": name,
                "category": category,
                "image_url": image_url,
                "description": description,
                "currency": currency,
                "food_item": fi,
                "created_at": getattr(data, 'created_at', None),
            }
        return data


class MenuItemInMenuCreate(BaseModel):
    food_item_id: Optional[str] = None
    name: Optional[str] = None
    price: float = 0.0
    currency: str = "VND"
    image_url: Optional[str] = None
    category: str = "Món chính"
    is_available: bool = True
    description: Optional[str] = None
    display_order: int = 0


class MenuCreate(BaseModel):
    name: str
    category: str = "Food"
    description: Optional[str] = None
    is_active: bool = True
    items: Optional[List[MenuItemInMenuCreate]] = []


class MenuUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Tên thực đơn")
    category: Optional[str] = Field(None, description="Phân loại: Food, Beverage, Dessert, Combo...")
    description: Optional[str] = Field(None, description="Mô tả thực đơn")
    is_active: Optional[bool] = Field(None, description="Bật/Tắt hoạt động của thực đơn")


class MenuResponse(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str] = None
    is_active: bool
    items: List[MenuItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignFoodToMenuRequest(BaseModel):
    food_item_id: str
    price: Optional[float] = None
    display_order: int = 0
    is_available: bool = True


class MenuItemUpdate(BaseModel):
    price: Optional[float] = Field(None, description="Đơn giá áp dụng riêng tại thực đơn này (VND)")
    display_order: Optional[int] = Field(None, description="Thứ tự hiển thị trong thực đơn")
    is_available: Optional[bool] = Field(None, description="Có đang phục vụ tại thực đơn này không")
