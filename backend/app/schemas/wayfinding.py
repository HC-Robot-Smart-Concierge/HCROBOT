from math import cos, radians, sin
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator


MapId = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9_-]{0,63}$")]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
ImageUrl = Annotated[str, StringConstraints(pattern=(
    r"^(/maps/floor_(b[12]|[1-6])\.png|/api/v1/wayfinding/images/[a-f0-9-]{36})$"
))]
Color = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]


class Point(BaseModel):
    x: float = Field(ge=0, le=6000)
    y: float = Field(ge=0, le=6000)


RoutePoints = Annotated[list[Point], Field(max_length=200)]


class FloorVertex(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


def is_simple_floor_polygon(vertices: list[FloorVertex]) -> bool:
    epsilon = 1e-9

    def turn(a, b, c):
        cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
        return 0 if abs(cross) <= epsilon else (1 if cross > 0 else -1)

    def inside_bounds(a, b, point):
        return (
            min(a.x, b.x) - epsilon <= point.x <= max(a.x, b.x) + epsilon
            and min(a.y, b.y) - epsilon <= point.y <= max(a.y, b.y) + epsilon
        )

    def edges_intersect(a, b, c, d):
        abc, abd = turn(a, b, c), turn(a, b, d)
        cda, cdb = turn(c, d, a), turn(c, d, b)
        return (
            abc * abd < 0 and cda * cdb < 0
            or abc == 0 and inside_bounds(a, b, c)
            or abd == 0 and inside_bounds(a, b, d)
            or cda == 0 and inside_bounds(c, d, a)
            or cdb == 0 and inside_bounds(c, d, b)
        )

    edges = list(zip(vertices, vertices[1:] + vertices[:1]))
    if len({(point.x, point.y) for point in vertices}) != len(vertices):
        return False
    if abs(sum(a.x * b.y - b.x * a.y for a, b in edges)) <= epsilon:
        return False
    for index, (a, b) in enumerate(edges):
        c = edges[(index + 1) % len(edges)][1]
        if turn(a, b, c) == 0 and (inside_bounds(a, b, c) or inside_bounds(b, c, a)):
            return False
        for other in range(index + 2, len(edges) - (1 if index == 0 else 0)):
            if edges_intersect(a, b, *edges[other]):
                return False
    return True


class FloorElement(Point):
    id: MapId
    kind: Literal["room", "wall", "corridor", "label"]
    width: float = Field(gt=0, le=6000)
    height: float = Field(gt=0, le=6000)
    color: Color
    text: str = Field(default="", max_length=100)
    vertices: Annotated[list[FloorVertex], Field(min_length=3, max_length=64)] | None = None
    rotation: int = Field(default=0, ge=0, lt=360)

    @model_validator(mode="after")
    def validate_polygon(self):
        if self.vertices is not None and (
            self.kind not in {"room", "corridor"} or not is_simple_floor_polygon(self.vertices)
        ):
            raise ValueError("Khu vực phải khép kín và các cạnh không được cắt nhau.")
        return self


class WayfindingFloor(BaseModel):
    id: MapId
    name: Label
    level: Label
    width: int = Field(default=1840, ge=320, le=6000)
    height: int = Field(default=1174, ge=320, le=6000)
    background: Color = "#F4F6FA"
    elements: list[FloorElement] = Field(default_factory=list, max_length=250)
    entry: Point

    def contains(self, point: Point) -> bool:
        return point.x <= self.width and point.y <= self.height

    @model_validator(mode="after")
    def validate_layout(self):
        if not self.contains(self.entry):
            raise ValueError("Cửa thang máy nằm ngoài sơ đồ tầng.")
        if len({item.id for item in self.elements}) != len(self.elements):
            raise ValueError("Mã đối tượng trên tầng phải duy nhất.")
        for item in self.elements:
            if item.x + item.width > self.width + 1e-6 or item.y + item.height > self.height + 1e-6:
                raise ValueError("Đối tượng nằm ngoài kích thước sơ đồ tầng.")
            if item.rotation:
                angle = radians(item.rotation)
                rotated_width = abs(cos(angle)) * item.width + abs(sin(angle)) * item.height
                rotated_height = abs(sin(angle)) * item.width + abs(cos(angle)) * item.height
                pad_x = max(0, (rotated_width - item.width) / 2)
                pad_y = max(0, (rotated_height - item.height) / 2)
                if (item.x - pad_x < -1e-6 or item.y - pad_y < -1e-6
                        or item.x + item.width + pad_x > self.width + 1e-6
                        or item.y + item.height + pad_y > self.height + 1e-6):
                    raise ValueError("Đối tượng sau khi xoay nằm ngoài sơ đồ tầng.")
        return self


class WayfindingDestination(BaseModel):
    id: MapId
    floorId: MapId
    name: Label
    coords: Point
    icon: Literal["pin", "desk", "pool", "gym", "spa", "food", "elevator", "room", "parking", "restroom"] = "pin"
    iconImage: ImageUrl | None = None
    iconScale: float = Field(default=1.0, ge=0.5, le=2.0)
    photo: ImageUrl | None = None
    enabled: bool = False
    points: RoutePoints | None = None
    time: str = Field(default="", max_length=50)
    distance: str = Field(default="", max_length=50)
    step1Text: str = Field(default="", max_length=500)
    step2Text: str = Field(default="", max_length=500)


class WayfindingConfig(BaseModel):
    floors: list[WayfindingFloor] = Field(min_length=1, max_length=50)
    lobbyFloorId: MapId
    lobbyStart: Point
    lobbyRoute: RoutePoints
    destinations: list[WayfindingDestination] = Field(max_length=500)

    @model_validator(mode="after")
    def validate_references(self):
        floors = {floor.id: floor for floor in self.floors}
        if len(floors) != len(self.floors) or self.lobbyFloorId not in floors:
            raise ValueError("Mã tầng phải duy nhất và tầng sảnh phải tồn tại.")
        if len({item.id for item in self.destinations}) != len(self.destinations):
            raise ValueError("Mã địa điểm phải duy nhất.")
        lobby = floors[self.lobbyFloorId]
        if not all(lobby.contains(point) for point in [self.lobbyStart, *self.lobbyRoute]):
            raise ValueError("Điểm xuất phát hoặc chặng qua sảnh nằm ngoài sơ đồ tầng.")
        for item in self.destinations:
            if item.floorId not in floors:
                raise ValueError(f"Tầng của địa điểm {item.name} không tồn tại.")
            if not all(floors[item.floorId].contains(point) for point in [item.coords, *(item.points or [])]):
                raise ValueError(f"Ghim hoặc tuyến đến {item.name} nằm ngoài sơ đồ tầng.")
            if item.enabled and item.points is None:
                raise ValueError(f"Cần tạo tuyến trước khi bật chỉ đường đến {item.name}.")
        return self


class WayfindingSnapshot(WayfindingConfig):
    revision: int = Field(ge=0)
