import asyncio
import os
import sys
import uuid

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password, verify_password
from app.models.account import Account
from app.models.department import Department


async def add_kitchen_account():
    username = "kitchen"
    plain_password = "123456"
    pwd_hash = hash_password(plain_password)

    async with AsyncSessionLocal() as session:
        # 1. Kiểm tra Department DEP-KITCHEN
        dept_res = await session.execute(
            select(Department).where(Department.id == "DEP-KITCHEN")
        )
        dept = dept_res.scalar_one_or_none()
        if not dept:
            dept = Department(
                id="DEP-KITCHEN",
                code="KITCHEN",
                name="Kitchen",
                description="Bộ phận Bếp & Chế biến ẩm thực (Kitchen Operations)",
                is_active=True,
            )
            session.add(dept)
            await session.commit()
            print("[INFO] Đã tạo phòng ban DEP-KITCHEN.")

        # 2. Kiểm tra xem account 'kitchen' đã tồn tại chưa
        acc_res = await session.execute(
            select(Account).where(Account.username == username)
        )
        account = acc_res.scalar_one_or_none()

        if not account:
            # Kiểm tra code KIT xem có bị trùng không
            code_res = await session.execute(
                select(Account).where(Account.code == "KIT")
            )
            code_existing = code_res.scalar_one_or_none()
            code_val = "KIT" if not code_existing else f"KIT_{uuid.uuid4().hex[:4].upper()}"

            new_id = f"ACC-{uuid.uuid4().hex[:8].upper()}"
            account = Account(
                id=new_id,
                username=username,
                password_hash=pwd_hash,
                code=code_val,
                full_name="Bộ phận Bếp",
                role="Kitchen Staff",
                department_id="DEP-KITCHEN",
                department="Kitchen",
                default_dashboard="restaurant",
                location="Khu vực Bếp Trung tâm (Tầng 1)",
                status="available",
                shift="Ca sáng (06:00 - 14:00)",
                phone="+84 90 123 4567",
                email="kitchen@aurora.hotel",
                current_tasks_count=0,
                is_fallback_agent=False,
                assigned_floors="Floor 1 - 5",
                notification_channels="Web Dashboard, Tablet Alert",
                is_active=True,
            )
            session.add(account)
            await session.commit()
            await session.refresh(account)
            print(f"[SUCCESS] Đã tạo mới tài khoản thành công!")
        else:
            # Cập nhật password hash và trạng thái
            account.password_hash = pwd_hash
            account.is_active = True
            account.status = "available"
            if not account.department_id:
                account.department_id = "DEP-KITCHEN"
            if not account.department:
                account.department = "Kitchen"
            if not account.default_dashboard:
                account.default_dashboard = "restaurant"
            await session.commit()
            await session.refresh(account)
            print(f"[SUCCESS] Tài khoản '{username}' đã tồn tại và vừa được cập nhật mật khẩu mới!")

        # 3. Kiểm tra tính hợp lệ của mật khẩu
        is_valid = verify_password(plain_password, account.password_hash)
        print("-" * 50)
        print("Chi tiết tài khoản trong bảng accounts:")
        print(f"  • ID:                 {account.id}")
        print(f"  • Username:           {account.username}")
        print(f"  • Password (Plain):   {plain_password}")
        print(f"  • Password Hash:      {account.password_hash}")
        print(f"  • Code:               {account.code}")
        print(f"  • Full Name:          {account.full_name}")
        print(f"  • Role:               {account.role}")
        print(f"  • Department ID:      {account.department_id}")
        print(f"  • Department Name:    {account.department}")
        print(f"  • Default Dashboard:  {account.default_dashboard}")
        print(f"  • Status:             {account.status}")
        print(f"  • Is Active:          {account.is_active}")
        print(f"  • Password Verify:    {'PASSED' if is_valid else 'FAILED'}")
        print("-" * 50)


if __name__ == "__main__":
    asyncio.run(add_kitchen_account())
