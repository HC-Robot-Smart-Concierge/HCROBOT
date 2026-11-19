from copy import deepcopy
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import get_current_user
from app.api.v1.endpoints.wayfinding import router
from app.core.database import get_db
from app.models.wayfinding import WayfindingImage, WayfindingPublication


def test_published_map_and_images_are_shared_and_versioned():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    WayfindingPublication.metadata.create_all(
        engine, tables=[WayfindingPublication.__table__, WayfindingImage.__table__]
    )

    async def local_db():
        with Session(engine) as session:
            yield SimpleNamespace(
                add=session.add,
                get=AsyncMock(side_effect=session.get),
                scalars=AsyncMock(side_effect=session.scalars),
                execute=AsyncMock(side_effect=session.execute),
                commit=AsyncMock(side_effect=session.commit),
                rollback=AsyncMock(side_effect=session.rollback),
            )

    app = FastAPI()
    app.include_router(router, prefix="/wayfinding")
    app.dependency_overrides[get_db] = local_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role="reception")

    with TestClient(app) as client:
        original = client.get("/wayfinding").json()
        assert original["revision"] == 0
        assert len(original["floors"]) == 8
        assert original["floors"][0]["elements"]
        assert "image" not in original["floors"][0]
        assert client.put("/wayfinding", json=original).status_code == 403

        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(role="admin")
        assert client.post("/wayfinding/images", files={"file": ("bad.png", b"invalid")}).status_code == 415
        image = BytesIO()
        Image.new("RGB", (12, 12)).save(image, "PNG")
        response = client.post("/wayfinding/images", files={"file": ("floor.png", image.getvalue())})
        assert response.status_code == 201
        image_url = response.json()["url"]
        image_path = image_url.removeprefix("/api/v1")
        assert client.get(image_path).content == image.getvalue()

        draft = deepcopy(original)
        draft["floors"].append({
            "id": "floor_9", "name": "Tầng 9", "level": "9", "entry": {"x": 40, "y": 50},
            "width": 900, "height": 1350, "background": "#E2EDFA",
            "elements": [{
                "kind": "room", "id": "room_9", "text": "", "x": 20, "y": 30,
                "width": 120, "height": 150, "color": "#879BB8", "rotation": 15,
                "vertices": [{"x": x, "y": y} for x, y in [(0, 0), (1, 0), (1, 0.4), (0.5, 0.4), (0.5, 1), (0, 1)]],
            }],
        })
        draft["destinations"].append({
            "id": "place_9", "name": "Spa mới", "floorId": "floor_9", "coords": {"x": 80, "y": 90},
            "photo": image_url, "iconImage": image_url, "icon": "spa", "iconScale": 1.5, "enabled": True, "points": None,
        })
        assert client.put("/wayfinding", json=draft).status_code == 422
        assert client.get("/wayfinding").json() == original

        draft["destinations"][-1]["points"] = [{"x": 65, "y": 75}]
        invalid = deepcopy(draft)
        invalid["floors"][-1]["elements"][0]["width"] = 900
        assert client.put("/wayfinding", json=invalid).status_code == 422
        invalid = deepcopy(draft)
        invalid["floors"][-1]["elements"][0]["x"] = 0
        assert client.put("/wayfinding", json=invalid).status_code == 422
        invalid = deepcopy(draft)
        invalid["floors"][-1]["elements"][0]["vertices"] = [
            {"x": x, "y": y} for x, y in [(0, 0), (1, 1), (1, 0), (0.25, 1)]
        ]
        assert client.put("/wayfinding", json=invalid).status_code == 422
        invalid = deepcopy(draft)
        invalid["destinations"][-1]["coords"]["x"] = 901
        assert client.put("/wayfinding", json=invalid).status_code == 422
        invalid = deepcopy(draft)
        invalid["destinations"][-1]["iconScale"] = 2.1
        assert client.put("/wayfinding", json=invalid).status_code == 422
        published = client.put("/wayfinding", json=draft)
        assert published.status_code == 200
        assert client.put("/wayfinding", json=draft).status_code == 409
        version_one = client.get("/wayfinding").json()
        assert version_one == published.json()
        assert version_one["revision"] == 1
        assert version_one["floors"][-1] == draft["floors"][-1]
        assert version_one["destinations"][-1]["iconScale"] == 1.5

        version_one["destinations"][-1]["enabled"] = False
        assert client.put("/wayfinding", json=version_one).json()["revision"] == 2
        assert client.put("/wayfinding", json=version_one).status_code == 409
        disabled = client.get("/wayfinding").json()["destinations"][-1]
        assert disabled["enabled"] is False and disabled["photo"] == image_url

        with Session(engine) as session:
            publication = session.get(WayfindingPublication, 1)
            old_config = deepcopy(publication.config)
            for floor in old_config["floors"]:
                for key in ("width", "height", "elements", "background"):
                    del floor[key]
            old_config["floors"][0]["image"] = "/maps/floor_b2.png"
            old_config["floors"][-1]["image"] = image_url
            publication.config = old_config
            session.commit()

        converted = client.get("/wayfinding").json()
        assert converted["floors"][0]["elements"] == original["floors"][0]["elements"]
        assert converted["floors"][-1]["elements"] == []
        assert converted["destinations"][-1] == disabled

    engine.dispose()
