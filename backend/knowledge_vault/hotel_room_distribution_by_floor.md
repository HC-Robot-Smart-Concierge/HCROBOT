---
title: Phân Bố Số Lượng Phòng Nghỉ Theo Từng Tầng Khách Sạn Aurora Grand (Room Distribution Per Floor)
category: room_distribution
hotel: Aurora Grand Hotel
language: vi_en
tags: [so_luong_phong, phan_bo_phong, phong_theo_tang, tang_3, tang_4, room_count, rooms_per_floor, floor_rooms, room_distribution, guest_rooms]
---

# Phân Bố Số Lượng Phòng Nghỉ Theo Từng Tầng Khách Sạn Aurora Grand (Room Distribution Per Floor)

> **Mục đích:** Tài liệu tri thức chuẩn mực dành cho Hệ thống RAG (Retrieval-Augmented Generation) và Robot Lễ tân Concierge (Rora). Cung cấp thông tin chuẩn xác về số lượng phòng nghỉ lưu trú, danh sách mã phòng cụ thể và phân bổ chức năng của từng tầng trong khách sạn.
> **Tên cơ sở:** Khách Sạn Aurora Grand (Aurora Grand Hotel).
> **Tổng số tầng:** 8 tầng chức năng (2 tầng hầm và 6 tầng nổi).
> **Tổng số phòng lưu trú:** Đúng 20 phòng nghỉ hoàn chỉnh (tập trung tại Tầng 3 và Tầng 4).

---

## 1. Tổng Quan Số Lượng Phòng Nghỉ Toàn Khách Sạn (Property Overview)

- **Tổng số phòng lưu trú cho khách:** 20 phòng tiêu chuẩn và cao cấp.
- **Các tầng có phòng lưu trú của khách:** Duy nhất **Tầng 3** (10 phòng) và **Tầng 4** (10 phòng).
- **Các tầng không có phòng lưu trú (0 phòng):** Tầng Hầm B2, Tầng Hầm B1, Tầng Trệt (Lễ tân), Tầng 2 (Bếp ẩm thực nội bộ), Tầng 5 (Hồ bơi vô cực & Gym & Spa), Tầng 6 (Rooftop Coffee & Bar & Karaoke).
- **Quy tắc đánh số phòng:**
  - Phòng bắt đầu bằng chữ số **3** (301 đến 310) tọa lạc tại **Tầng 3**.
  - Phòng bắt đầu bằng chữ số **4** (401 đến 410) tọa lạc tại **Tầng 4**.

---

## 2. Bảng Thống Kê Chi Tiết Số Lượng Phòng Cho Mỗi Tầng (Rooms Per Floor Table)

| Tầng (Floor) | Mã Tầng (Floor ID) | Chức năng chính (Primary Function) | Số lượng phòng nghỉ (Guest Rooms) | Danh sách số phòng cụ thể (Room Numbers) | Ghi chú vận hành & Tiện ích (Notes & Facilities) |
|---|---|---|---|---|---|
| **Tầng Hầm B2** | FLR-B2 | Bãi đỗ xe ô tô | **0 phòng** | Không có phòng lưu trú | Sức chứa khoảng 40 xe ô tô, có trạm sạc điện thoại |
| **Tầng Hầm B1** | FLR-B1 | Bãi giữ xe máy & Kỹ thuật | **0 phòng** | Không có phòng lưu trú | Sức chứa khoảng 120 xe máy, xe đạp, phòng máy kỹ thuật |
| **Tầng Trệt (G)** | FLR-01 | Sảnh chính & Quầy Lễ tân | **0 phòng** | Không có phòng lưu trú | Quầy Lễ tân (Front Desk) 24/7, Cửa hàng lưu niệm, Thang máy A |
| **Tầng 2** | FLR-02 | Bếp trung tâm Room Service | **0 phòng** | Không có phòng lưu trú | Khu vực nội bộ bếp chế biến Room Service, kho thực phẩm (Staff Only) |
| **Tầng 3** | FLR-03 | Tầng phòng nghỉ lưu trú | **10 phòng** | **301, 302, 303, 304, 305, 306, 307, 308, 309, 310** | Phòng Tiêu Chuẩn (Standard King / Twin Bed), diện tích 32m2/phòng |
| **Tầng 4** | FLR-04 | Tầng phòng nghỉ lưu trú | **10 phòng** | **401, 402, 403, 404, 405, 406, 407, 408, 409, 410** | Phòng Tiêu Chuẩn & Cao Cấp (Deluxe Ocean View), diện tích 35m2/phòng |
| **Tầng 5** | FLR-05 | Khu thư giãn, Thể thao & Spa | **0 phòng** | Không có phòng lưu trú | Hồ bơi vô cực (Infinity Pool), Phòng Gym, Aurora Luxury Spa & Sauna |
| **Tầng 6** | FLR-06 | Giải trí tầng thượng & Cafe | **0 phòng** | Không có phòng lưu trú | Quán Rooftop Coffee & View, Sky Lounge Bar, Phòng VIP Karaoke |
| **TỔNG CỘNG** | **8 Tầng** | **Toàn bộ khách sạn** | **20 PHÒNG** | **20 phòng (301-310 và 401-410)** | **100% phòng được trang bị khóa thẻ từ NFC và mã PIN 4 số** |

---

## 3. Chi Tiết Bố Trí Dãy Phòng Từng Tầng (Corridor Room Layout)

### Tầng 3 — Tầng Phòng Nghỉ Tiêu Chuẩn (10 Phòng)
- **Tổng số phòng:** 10 phòng (Phòng 301 đến Phòng 310).
- **Hành lang dãy trên (bên phải thang máy bước ra):** Gồm 5 phòng: **301, 302, 303, 304, 305**.
- **Hành lang dãy dưới (đối diện dãy trên):** Gồm 5 phòng: **306, 307, 308, 309, 310**.
- **Loại phòng:** Phòng Standard King Bed và Standard Twin Bed, trang bị đầy đủ minibar, smart TV, bàn làm việc, két an toàn và phòng tắm đứng tiện nghi.

### Tầng 4 — Tầng Phòng Nghỉ Cao Cấp (10 Phòng)
- **Tổng số phòng:** 10 phòng (Phòng 401 đến Phòng 410).
- **Hành lang dãy trên (hướng nhìn thoáng đãng):** Gồm 5 phòng: **401, 402, 403, 404, 405**.
- **Hành lang dãy dưới (đối diện dãy trên):** Gồm 5 phòng: **406, 407, 408, 409, 410**.
- **Loại phòng:** Phòng Deluxe City & Ocean View, ban công riêng ngắm cảnh, bồn tắm nằm cao cấp và dịch vụ trà chiều chào đón.

---

## 4. Các Câu Hỏi Thường Gặp Về Số Lượng Phòng (FAQ & Robot Rora Scripts)

### Khách hỏi: "Khách sạn có tổng cộng bao nhiêu phòng?" / "How many rooms in total?"
- **Tiếng Việt:** Dạ khách sạn Aurora Grand có tổng cộng 20 phòng nghỉ lưu trú tiện nghi, được bố trí tại Tầng 3 (10 phòng từ 301 đến 310) và Tầng 4 (10 phòng từ 401 đến 410) ạ.
- **English:** Aurora Grand Hotel features a total of 20 guest rooms, situated on Level 3 (10 rooms from 301 to 310) and Level 4 (10 rooms from 401 to 410).

### Khách hỏi: "Mỗi tầng có bao nhiêu phòng?" / "How many rooms on each floor?"
- **Tiếng Việt:** Dạ các tầng phòng nghỉ của khách sạn gồm Tầng 3 có 10 phòng (301 đến 310) và Tầng 4 có 10 phòng (401 đến 410). Các tầng còn lại là tầng tiện ích chung như Lễ tân (Tầng Trệt), Bếp ẩm thực (Tầng 2), Hồ bơi và Spa (Tầng 5), Quán Cafe và Bar (Tầng 6), không có phòng lưu trú ạ.
- **English:** Our guest room floors consist of Level 3 with 10 rooms (301 to 310) and Level 4 with 10 rooms (401 to 410). Other levels are dedicated to public facilities such as the Lobby, Kitchen, Pool & Spa, and Rooftop Lounge, with no guest rooms.

### Khách hỏi: "Tầng 3 có bao nhiêu phòng?" / "Tầng 3 gồm những phòng nào?"
- **Tiếng Việt:** Dạ Tầng 3 có đúng 10 phòng nghỉ tiêu chuẩn, gồm các phòng mang số hiệu từ 301, 302, 303, 304, 305, 306, 307, 308, 309 đến 310 ạ.
- **English:** Level 3 has 10 standard guest rooms numbered from 301 to 310.

### Khách hỏi: "Tầng 4 có bao nhiêu phòng?" / "Tầng 4 gồm những phòng nào?"
- **Tiếng Việt:** Dạ Tầng 4 có đúng 10 phòng nghỉ cao cấp, gồm các phòng mang số hiệu từ 401, 402, 403, 404, 405, 406, 407, 408, 409 đến 410 ạ.
- **English:** Level 4 has 10 deluxe guest rooms numbered from 401 to 410.

### Khách hỏi: "Tầng 5 có phòng nghỉ không?" / "Tầng 2 có phòng ngủ không?"
- **Tiếng Việt:** Dạ không ạ. Tầng 5 là khu tiện ích thư giãn bao gồm Hồ bơi vô cực, Phòng Gym và Spa; còn Tầng 2 là khu vực Bếp trung tâm nấu ăn. Cả hai tầng này đều không có phòng ngủ lưu trú. Phòng nghỉ của khách chỉ nằm ở Tầng 3 và Tầng 4 ạ.
- **English:** No, Level 5 is dedicated to the Infinity Pool, Fitness Gym, and Spa, while Level 2 is our central culinary kitchen. Neither has guest rooms. All guest accommodations are on Level 3 and Level 4.
