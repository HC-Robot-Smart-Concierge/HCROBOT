# 📖 HƯỚNG DẪN SỬ DỤNG ALEMBIC (DATABASE MIGRATIONS)
> **Dự án:** HC-Robot Smart Concierge  
> **Backend Stack:** FastAPI, SQLAlchemy 2.0 (Async), PostgreSQL (asyncpg), Alembic  
> **Vị trí file cấu hình:** `backend/alembic.ini` & `backend/alembic/env.py`

---

## 📌 1. Tổng Quan & Cơ Chế Hoạt Động

Alembic là công cụ quản lý phiên bản cơ sở dữ liệu (Database Migrations) cho SQLAlchemy. Trong dự án **HC-Robot**, Alembic được cấu hình để:
- Tự động đọc cấu hình kết nối DB từ file `backend/.env` thông qua `app.core.config.settings.async_database_url`.
- Tự động nạp toàn bộ model đã khai báo trong `backend/app/models/__init__.py` vào `Base.metadata`.
- Thực thi migration ở chế độ **Async Engine** (`asyncpg` / `asyncio`).

---

## ⚡ 2. Bảng Tra Cứu Nhanh (Cheat Sheet)

> **LƯU Ý:** Luôn đứng ở thư mục `backend` khi chạy lệnh terminal:
> ```bash
> cd backend
> # Kích hoạt môi trường ảo (nếu có, vd: venv\Scripts\activate)
> ```

| Thao tác | Lệnh | Giải thích |
| :--- | :--- | :--- |
| **Tạo migration tự động** | `alembic revision --autogenerate -m "mo_ta_thay_doi"` | So sánh Models với DB hiện tại và sinh code migration |
| **Tạo migration trống** | `alembic revision -m "ten_migration"` | Tạo file rỗng để tự viết raw SQL hoặc logic tùy chỉnh |
| **Cập nhật DB lên mới nhất** | `alembic upgrade head` | Chạy tất cả migration còn thiếu vào DB |
| **Nâng lên 1 version** | `alembic upgrade +1` | Chạy tiếp 1 version kế tiếp |
| **Rollback 1 version** | `alembic downgrade -1` | Quay lui 1 version gần nhất |
| **Rollback về ban đầu** | `alembic downgrade base` | Xóa sạch schema về ban đầu *(cẩn thận!)* |
| **Xem version hiện tại** | `alembic current` | Xem DB đang ở revision nào |
| **Xem lịch sử migrations** | `alembic history --verbose` | Xem chi tiết danh sách tất cả các version |
| **Gộp branch (conflict)** | `alembic merge heads -m "merge branches"` | Giải quyết xung đột khi có 2 nhánh migration cùng lúc |

---

## 🛠️ 3. Quy Trình Chuẩn Khi Thay Đổi Model / Database

Mỗi khi thêm bảng mới, đổi tên cột, thêm trường dữ liệu hoặc thay đổi quan hệ (relationship), hãy làm theo 5 bước sau:

### 🔹 Bước 1: Chỉnh sửa Model trong code
Thêm hoặc sửa class model trong thư mục `backend/app/models/` (ví dụ: `bell_service.py`, `staff.py`, v.v.).

### 🔹 Bước 2: Khai báo vào `app/models/__init__.py` ⚠️ (Bắt buộc)
Nếu tạo **file model mới**, bạn **bắt buộc** phải import vào `backend/app/models/__init__.py` để Alembic có thể quét thấy:
```python
# backend/app/models/__init__.py
from app.models.your_new_model import YourNewModel

__all__ = [
    # ... các model cũ ...
    "YourNewModel",
]
```

### 🔹 Bước 3: Tạo file Migration tự động
Chạy lệnh tạo migration:
```bash
alembic revision --autogenerate -m "add_column_priority_to_bell_requests"
```
Alembic sẽ tạo một file Python mới trong thư mục:
📂 `backend/alembic/versions/<revision_id>_add_column_priority_to_bell_requests.py`

### 🔹 Bước 4: Kiểm tra lại file Migration (Code Review)
Mở file vừa sinh ra trong thư mục `alembic/versions/` và kiểm tra 2 hàm:
- `upgrade()`: Chứa các lệnh sẽ áp dụng vào DB (vd: `op.add_column(...)`).
- `downgrade()`: Chứa các lệnh đảo ngược nếu rollback (vd: `op.drop_column(...)`).

> 💡 **Mẹo:** `autogenerate` rất thông minh nhưng đôi khi có thể bỏ sót việc đổi tên cột (thường bị nhận nhầm thành DROP cột cũ + ADD cột mới làm mất data). Hãy luôn rà soát trước khi apply.

### 🔹 Bước 5: Thực thi cập nhật vào Database
Áp dụng thay đổi vào PostgreSQL:
```bash
alembic upgrade head
```
Sau khi chạy thành công, mở pgAdmin hoặc DBeaver để kiểm tra bảng và cột mới.

---

## 🔄 4. Hướng Dẫn Rollback Khi Có Lỗi

Nếu vừa chạy `alembic upgrade head` nhưng phát hiện lỗi hoặc muốn hoàn tác:

1. **Quay lui lại 1 bước:**
   ```bash
   alembic downgrade -1
   ```
2. **Xóa file migration lỗi** trong thư mục `backend/alembic/versions/` nếu migration đó chưa được push lên Git.
3. Chỉnh sửa lại model cho đúng, sau đó chạy lại Bước 3 & 4.

---

## ⚠️ 5. Xử Lý Các Sự Cố Thường Gặp (Troubleshooting)

### 🔴 Lỗi 1: `Target database is not up to date` hoặc `Multiple head revisions are present`
- **Nguyên nhân:** Khi làm việc nhóm, 2 người cùng tạo migration trên 2 nhánh Git khác nhau. Khi merge code về sẽ có 2 "heads".
- **Cách xử lý:**
  1. Kiểm tra các head hiện có:
     ```bash
     alembic heads
     ```
  2. Tạo 1 migration gộp 2 nhánh:
     ```bash
     alembic merge heads -m "merge conflicting migration heads"
     ```
  3. Cập nhật DB:
     ```bash
     alembic upgrade head
     ```

### 🔴 Lỗi 2: Alembic không phát hiện thay đổi trong Model (`No changes detected`)
- **Nguyên nhân:** 
  1. File model mới chưa được import vào `backend/app/models/__init__.py`.
  2. Model không kế thừa từ `Base` (`from app.core.database import Base`).
  3. Quên lưu file code trước khi gõ lệnh.

### 🔴 Lỗi 3: Lỗi kết nối Database (`Connection refused` hoặc `password authentication failed`)
- **Nguyên nhân:** File `backend/.env` chưa có hoặc thông số kết nối PostgreSQL sai.
- **Cách xử lý:**
  - Kiểm tra file `backend/.env`:
    ```env
    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=postgres
    POSTGRES_HOST=localhost
    POSTGRES_PORT=5432
    POSTGRES_DB=hc_robot_db
    DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/hc_robot_db
    ```
  - Đảm bảo service PostgreSQL đang hoạt động trên máy hoặc Docker container.

### 🔴 Lỗi 4: Bảng `alembic_version` bị lệch trạng thái
- **Cách xử lý:**
  Nếu DB đã có sẵn schema nhưng Alembic báo chưa migrate, có thể đánh dấu DB đang ở version chỉ định mà không chạy lại SQL:
  ```bash
  alembic stamp head
  ```
  *(Chỉ dùng lệnh này khi bạn chắc chắn cấu trúc DB hiện tại đã khớp với model code)*

---

## 📂 6. Cấu Trúc Thư Mục Liên Quan

```text
backend/
├── alembic.ini                   # Cấu hình chính của Alembic
├── alembic/
│   ├── env.py                    # Script nạp cấu hình động & async runner
│   ├── README
│   ├── script.py.mako            # Template sinh file migration
│   └── versions/                 # Nơi lưu trữ tất cả các file migration (.py)
│       └── 87055640bdf0_initial_schema_after_cleanup.py
├── app/
│   ├── core/
│   │   ├── config.py             # Đọc biến môi trường .env
│   │   └── database.py           # Khai báo Base metadata & engine
│   └── models/
│       ├── __init__.py           # NƠI ĐĂNG KÝ TẤT CẢ MODELS ĐỂ ALEMBIC THẤY
│       ├── bell_service.py
│       ├── staff.py
│       └── ...
└── .env                          # Chuỗi kết nối DATABASE_URL
```
