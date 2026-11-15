import { useEffect } from 'react';
import { createZoneSyncMsg } from '../../../../services/rosbridgeService';
import { fetchZones, saveZone, deleteZone } from '../../../../services/workflowApi';
import { SIMULATOR_HOTEL_ZONES } from './workflowSimulatorUtils';

/**
 * Loads hotel safety zones and provides CRUD + ROS 2 /hotel_zones sync handlers.
 */
export function useWorkflowZoneActions({
  zones,
  setZones,
  selectedZone,
  setSelectedZone,
  setShowZones,
  setIsZoneEditMode,
  setHasUnsavedZones,
  setIsSavingZones,
  setIsZoneMenuOpen,
  setIsMapMenuOpen,
  isRosEnabledRef,
  rosClientRef,
  onNotify,
}) {
  // Tai danh sach Vung tu backend CSDL neu co, fallback la 3 vung mac dinh
  useEffect(() => {
    let isMounted = true;
    fetchZones()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setZones(data);
        }
      })
      .catch(() => {
        // Fallback giu nguyen SIMULATOR_HOTEL_ZONES
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const syncZonesToRos = (nextZones) => {
    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_zones',
        'std_msgs/String',
        createZoneSyncMsg(nextZones)
      );
    }
  };

  // Them Vung moi tren sa ban (Add Zone)
  const handleAddZone = (type) => {
    setIsZoneMenuOpen(false);
    setIsMapMenuOpen(false);
    const count = zones.filter((z) => z.type === type).length + 1;
    let name = '';
    let speedLimit = null;
    let width = 2.0;
    let height = 2.0;

    const slot = zones.length % 4;
    const initialX = Number((3.5 + slot * 0.8).toFixed(2));
    const initialY = Number((3.0 + (slot % 2 === 0 ? 0.4 : -0.4)).toFixed(2));

    if (type === 'KEEP_OUT') {
      name = `Khu Vực Cấm Vào #${count}`;
    } else if (type === 'SPEED_ZONE' || type === 'SLOW_SPEED') {
      name = `Vùng Giới Hạn Tốc Độ #${count}`;
      speedLimit = 0.20;
      width = 2.4;
      height = 2.0;
    } else {
      name = `Khu Vực Cấm Dừng #${count}`;
      width = 1.8;
      height = 1.6;
    }

    const newZone = {
      id: `zone_${Date.now()}`,
      name,
      type,
      x: initialX,
      y: initialY,
      width,
      height,
      speed_limit: speedLimit,
      description: 'Vùng được tạo mới bởi quản trị viên.',
    };

    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    setSelectedZone(newZone);
    setIsZoneEditMode(true);
    setShowZones(true);
    setHasUnsavedZones(true);
    syncZonesToRos(updatedZones);
    onNotify(`Đã thêm ${name}. Hãy kéo thân để di chuyển hoặc kéo 4 góc để co giãn.`, 'success');
  };

  // Xoa Vung duoc chon (Delete Zone)
  const handleDeleteZone = async (zoneId) => {
    if (!zoneId) return;
    const target = zones.find((z) => z.id === zoneId);
    const updatedZones = zones.filter((z) => z.id !== zoneId);
    setZones(updatedZones);
    setSelectedZone(null);
    setHasUnsavedZones(true);

    try {
      await deleteZone(zoneId);
    } catch {
      // Bỏ qua lỗi nếu zone chỉ tồn tại client-side
    }

    syncZonesToRos(updatedZones);
    onNotify(`Đã xóa vùng "${target?.name || zoneId}" khỏi bản đồ.`, 'info');
  };

  // Cap nhat thuoc tinh cua Vung dang chon (Edit Zone attributes)
  const handleUpdateSelectedZone = (field, value) => {
    if (!selectedZone) return;
    const updated = { ...selectedZone, [field]: value };
    setSelectedZone(updated);
    setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? updated : z)));
    setHasUnsavedZones(true);
  };

  // Luu cau hinh 3 Vung Chuc Nang vao CSDL va phat len topic ROS 2
  const handleSaveZones = async () => {
    setIsSavingZones(true);
    try {
      for (const z of zones) {
        await saveZone(z);
      }
      syncZonesToRos(zones);
      setHasUnsavedZones(false);
      onNotify('Đã lưu cấu hình vị trí & kích thước Vùng thành công.', 'success');
    } catch {
      syncZonesToRos(zones);
      setHasUnsavedZones(false);
      onNotify('Đã áp dụng vị trí Vùng cho phiên làm việc hiện tại.', 'info');
    } finally {
      setIsSavingZones(false);
    }
  };

  // Khoi phuc vi tri 3 Vung Chuc Nang ve mac dinh
  const handleResetDefaultZones = () => {
    setZones(SIMULATOR_HOTEL_ZONES);
    setSelectedZone(null);
    setHasUnsavedZones(true);
    syncZonesToRos(SIMULATOR_HOTEL_ZONES);
    onNotify('Đã khôi phục 3 Vùng Chức Năng về thông số chuẩn sảnh 10m x 6m.', 'info');
  };

  return {
    handleAddZone,
    handleDeleteZone,
    handleUpdateSelectedZone,
    handleSaveZones,
    handleResetDefaultZones,
  };
}
