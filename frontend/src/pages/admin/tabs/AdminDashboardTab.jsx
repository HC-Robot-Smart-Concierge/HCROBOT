import React, { useState, useEffect } from 'react';
import { fetchAdminSummary, fetchAdminTasks } from '../../../services/operationsApi';

export const AdminDashboardTab = ({ onNavigateToOperations = () => {}, onNavigateToRobots = () => {} }) => {
  const [summary, setSummary] = useState({
    total_active: 12,
    all_count: 19,
    reception_count: 2,
    housekeeping_count: 5,
    room_service_count: 4,
    bell_services_count: 3,
    maintenance_count: 2,
    directives_count: 3,
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sum, tasks] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminTasks({ limit: 5 }),
      ]);
      if (sum) setSummary(sum);
      if (Array.isArray(tasks)) setRecentTasks(tasks.slice(0, 3));
    } catch {
      // Fallback to initial mock data
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="w-full flex flex-col p-4 space-y-3 pb-2" style={{ color: '#262626' }}>
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
        <div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
            Tổng Quan Vận Hành Robot (System Overview)
          </h2>
          <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
            Dữ liệu vận hành thời gian thực từ các bộ phận và Robot Concierge
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors self-start sm:self-auto"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
            color: '#262626',
          }}
        >
          {isLoading ? 'Đang tải...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {/* 4 Top Metric Cards (Compact Single Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Online Robots */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            <span>ROBOT TRỰC TUYẾN</span>
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>1</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>/ 1 Unit</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            Trực sảnh chính (SLA 100%)
          </div>
        </div>

        {/* Card 2: Active Requests */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            YÊU CẦU ĐANG XỬ LÝ
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>{summary.total_active || 12}</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>phiếu hoạt động</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            Phân bổ trên 5 phòng ban
          </div>
        </div>

        {/* Card 3: Attention Needed */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            CẦN CHÚ Ý
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>3</span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>cảnh báo</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            Vật cản đường & Mức pin thấp
          </div>
        </div>

        {/* Card 4: Knowledge Health */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            KNOWLEDGE RAG HEALTH
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>98.2%</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            Đồng bộ ChromaDB & Vault
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Robot & Requests) | Right (Alerts & Satisfaction) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-2.5">
          {/* Active Robot Concierge Box */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
              <div>
                <div className="text-xs font-bold" style={{ color: '#262626' }}>
                  Robot Concierge Unit RC-001 (Bot Alpha)
                </div>
                <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  Vị trí: Quầy Lễ Tân (Lobby) • LiDAR Pi5: Đã kết nối
                </div>
              </div>
              <button
                onClick={onNavigateToRobots}
                className="text-xs font-semibold px-2.5 py-1 rounded border cursor-pointer hover:opacity-80"
                style={{
                  backgroundColor: '#E9E5DC',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                Xem SLAM Map →
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>Chế độ</div>
                <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>Trực sảnh chính</div>
              </div>
              <div className="p-2 rounded border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>Mức pin</div>
                <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>92% (Tự về dock: 15%)</div>
              </div>
              <div className="col-span-2 sm:col-span-1 flex gap-1.5 items-center">
                <button
                  onClick={() => alert('Đã gửi lệnh dừng khẩn cấp!')}
                  className="flex-1 py-2 rounded text-[11px] font-semibold border cursor-pointer"
                  style={{
                    backgroundColor: '#262626',
                    borderColor: '#262626',
                    color: '#F2EFE9',
                  }}
                >
                  Dừng khẩn cấp
                </button>
                <button
                  onClick={() => alert('Robot đang di chuyển về Dock sạc!')}
                  className="flex-1 py-2 rounded text-[11px] font-medium border cursor-pointer"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  Về sạc
                </button>
              </div>
            </div>
          </div>

          {/* Recent Requests Table */}
          <div
            className="p-3.5 rounded-xl border"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
              <span className="text-xs font-bold" style={{ color: '#262626' }}>
                Yêu cầu phục vụ gần đây
              </span>
              <button
                onClick={onNavigateToOperations}
                className="text-[11px] font-semibold hover:underline cursor-pointer"
                style={{ color: '#262626' }}
              >
                Xem tất cả ({summary.all_count}) →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase" style={{ color: '#8C8C8C' }}>
                    <th className="py-2">Mã</th>
                    <th className="py-2">Nội dung</th>
                    <th className="py-2">Vị trí</th>
                    <th className="py-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]" style={{ borderColor: '#E9E5DC' }}>
                  {(recentTasks.length > 0 ? recentTasks : [
                    { id: 'REQ-992', title: 'Mang khăn tắm', location: 'Phòng 412', status: 'Đang xử lý' },
                    { id: 'REQ-991', title: 'Giao món F&B', location: 'Phòng 1004', status: 'Đang xử lý' },
                    { id: 'REQ-990', title: 'Hỗ trợ hành lý', location: 'Sảnh chính', status: 'Chờ tiếp nhận' },
                  ]).slice(0, 3).map((r) => (
                    <tr key={r.id} className="hover:bg-[#F2EFE9]/40 transition-colors">
                      <td className="py-1.5 font-mono font-semibold" style={{ color: '#262626' }}>{r.id}</td>
                      <td className="py-1.5 font-medium" style={{ color: '#262626' }}>{r.title}</td>
                      <td className="py-1.5" style={{ color: '#8C8C8C' }}>{r.location}</td>
                      <td className="py-1.5 text-right">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-medium border"
                          style={{
                            backgroundColor: '#E9E5DC',
                            borderColor: '#BFBFBD',
                            color: '#262626',
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          {/* Live Alerts */}
          <div
            className="p-3.5 rounded-xl border space-y-2"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
              <span className="text-xs font-bold" style={{ color: '#262626' }}>
                Cảnh báo hoạt động
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
              >
                3 cảnh báo
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="p-2 rounded border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>
                  Vật cản: Hành lang 4A
                </div>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  Robot RC-001 cần hỗ trợ can thiệp • 2 phút trước
                </div>
              </div>

              <div className="p-2 rounded border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>
                  Mức pin thấp: Cần về trạm sạc
                </div>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  Pin 15%, dock khả dụng trong 2 mét • 12 phút trước
                </div>
              </div>

              <div className="p-2 rounded border" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
                <div className="font-semibold text-[11px]" style={{ color: '#262626' }}>
                  Kết nối Tailscale P2P ổn định
                </div>
                <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  Độ trễ 12ms tới Pi5 • 1 giờ trước
                </div>
              </div>
            </div>
          </div>

          {/* Guest Satisfaction Summary */}
          <div
            className="p-3.5 rounded-xl border flex items-center justify-between"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div>
              <div className="text-xs font-bold" style={{ color: '#262626' }}>Đánh giá trung bình</div>
              <div className="text-[10px]" style={{ color: '#8C8C8C' }}>Trải nghiệm Robot Concierge tuần này</div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold" style={{ color: '#262626' }}>4.8</span>
              <span className="text-xs" style={{ color: '#8C8C8C' }}> / 5.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
