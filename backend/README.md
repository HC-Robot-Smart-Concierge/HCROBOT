# ⚙️ BACKEND - INTELLIGENT HOTEL CONCIERGE ROBOT (HC-ROBOT)

Thư mục chứa mã nguồn Server Trung Tâm (Central Backend Server) xây dựng trên nền tảng **FastAPI (Python)**.

---

## 📚 Tài Liệu Kiến Trúc

- Xem tài liệu giải thích chi tiết kiến trúc và cách áp dụng FastAPI vào hệ thống tại: **[FASTAPI_ARCHITECTURE.md](./FASTAPI_ARCHITECTURE.md)**

---

## ⚡ Các Tính Năng Chính Của Backend

1. **RESTful APIs**: Cung cấp endpoints cho Authentication, Quản lý Khách sạn, Tạo & Theo dõi Yêu cầu Dịch vụ, Quản trị Người dùng.
2. **Real-time Gateway (Socket.IO)**: Kết nối thời gian thực giữa Robot, Web Staff Dashboard và Mobile App.
3. **AI Core Engine**: Tích hợp Speech-to-Text (Faster-Whisper), Text-to-Speech (EdgeTTS), Large Language Model (GPT-4o/Gemini) và RAG Knowledge Base (ChromaDB).
4. **Auto Swagger Documentation**: Truy cập Swagger UI tại `http://localhost:8000/docs` sau khi chạy server.
