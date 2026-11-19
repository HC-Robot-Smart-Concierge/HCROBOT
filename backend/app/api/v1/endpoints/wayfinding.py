from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.models.wayfinding import WayfindingImage, WayfindingPublication
from app.schemas.wayfinding import WayfindingConfig, WayfindingSnapshot


router = APIRouter()
_DEFAULT_CONFIG = WayfindingConfig.model_validate_json(
    (Path(__file__).resolve().parents[3] / "schemas" / "wayfinding_defaults.json").read_text(encoding="utf-8")
)
_DEFAULT_FLOORS = {floor.id: floor for floor in _DEFAULT_CONFIG.floors}
_IMAGE_PREFIX = "/api/v1/wayfinding/images/"
_IMAGE_LIMIT = 8 * 1024 * 1024
_IMAGE_TYPES = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}
_CONFLICT = "Bản đồ đã được cập nhật. Hãy tải lại trước khi công bố."


async def require_wayfinding_admin(user=Depends(get_current_user)):
    if (user.role or "").lower() != "admin":
        raise HTTPException(403, "Cần quyền quản trị bản đồ.")


@router.get("", response_model=WayfindingSnapshot)
async def get_wayfinding(response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    published = await db.get(WayfindingPublication, 1)
    if published is None:
        return WayfindingSnapshot(revision=0, **_DEFAULT_CONFIG.model_dump())
    config = published.config
    floors = [
        {**floor, "elements": [item.model_dump() for item in _DEFAULT_FLOORS[floor["id"]].elements]}
        if "elements" not in floor and floor["id"] in _DEFAULT_FLOORS
        and floor.get("image", "").startswith("/maps/floor_") else floor
        for floor in config["floors"]
    ]
    return WayfindingSnapshot(**{**config, "floors": floors, "revision": published.revision})


@router.put("", response_model=WayfindingSnapshot, dependencies=[Depends(require_wayfinding_admin)])
async def publish_wayfinding(payload: WayfindingSnapshot, db: AsyncSession = Depends(get_db)):
    images = {item.photo for item in payload.destinations if item.photo}
    images.update(item.iconImage for item in payload.destinations if item.iconImage)
    image_ids = {url.removeprefix(_IMAGE_PREFIX) for url in images if url.startswith(_IMAGE_PREFIX)}
    if image_ids:
        stored = await db.scalars(select(WayfindingImage.id).where(WayfindingImage.id.in_(image_ids)))
        if set(stored) != image_ids:
            raise HTTPException(422, "Có ảnh hoặc icon địa điểm không tồn tại.")

    config = payload.model_dump(exclude={"revision"}, mode="json")
    revision = payload.revision + 1
    if payload.revision == 0:
        db.add(WayfindingPublication(id=1, revision=revision, config=config))
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(409, _CONFLICT) from exc
    else:
        result = await db.execute(
            update(WayfindingPublication)
            .where(WayfindingPublication.id == 1, WayfindingPublication.revision == payload.revision)
            .values(revision=revision, config=config)
        )
        if result.rowcount != 1:
            raise HTTPException(409, _CONFLICT)
        await db.commit()
    return WayfindingSnapshot(revision=revision, **config)


@router.post("/images", status_code=201, dependencies=[Depends(require_wayfinding_admin)])
async def upload_wayfinding_image(file: UploadFile, db: AsyncSession = Depends(get_db)):
    content = await file.read(_IMAGE_LIMIT + 1)
    if len(content) > _IMAGE_LIMIT:
        raise HTTPException(413, "Ảnh vượt quá 8 MB.")
    content_type = await run_in_threadpool(validate_image, content)
    image_id = str(uuid4())
    db.add(WayfindingImage(id=image_id, content_type=content_type, content=content))
    await db.commit()
    return {"url": f"{_IMAGE_PREFIX}{image_id}"}


def validate_image(content: bytes) -> str:
    try:
        with Image.open(BytesIO(content), formats=list(_IMAGE_TYPES)) as image:
            if image.width * image.height > 25_000_000:
                raise HTTPException(413, "Ảnh vượt quá 25 megapixel.")
            image.load()
            return _IMAGE_TYPES[image.format]
    except Image.DecompressionBombError as exc:
        raise HTTPException(413, "Ảnh vượt quá 25 megapixel.") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(415, "Chọn ảnh PNG, JPEG hoặc WebP hợp lệ.") from exc


@router.get("/images/{image_id}")
async def get_wayfinding_image(image_id: UUID, db: AsyncSession = Depends(get_db)):
    image = await db.get(WayfindingImage, str(image_id))
    if image is None:
        raise HTTPException(404, "Không tìm thấy ảnh.")
    return Response(image.content, media_type=image.content_type, headers={
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
    })
