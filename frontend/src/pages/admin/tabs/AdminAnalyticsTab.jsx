import React, { useState, useEffect } from 'react';
import { fetchAnalyticsSummary } from '../../../services/operationsApi';

export const AdminAnalyticsTab = () => {
  const [data, setData] = useState({
    total_tasks: 0,
    active_tasks: 0,
    completed_tasks: 0,
    completion_rate: 0,
    robot_assigned_tasks: 0,
    human_tasks: 0,
    robot_rate: 0,
    total_sessions: 0,
    total_messages: 0,
    total_staff: 0,
    fallback_staff: 0,
    total_robots: 1,
    dept_distribution: {
      Reception: 0,
      Housekeeping: 0,
      'F&B': 0,
      'Bell Services': 0,
      Maintenance: 0,
    },
    recent_activities: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchAnalyticsSummary();
      if (res) setData(res);
    } catch {
      // Keep existing data on network error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalTasks = data.total_tasks || 1;
  const deptEntries = [
    { name: 'Lễ tân (Reception)', count: data.dept_distribution?.Reception || 0 },
    { name: 'Phục vụ phòng (F&B)', count: data.dept_distribution?.['F&B'] || 0 },
    { name: 'Buồng phòng (Housekeeping)', count: data.dept_distribution?.Housekeeping || 0 },
    { name: 'Hành lý (Bell Services)', count: data.dept_distribution?.['Bell Services'] || 0 },
    { name: 'Kỹ thuật (Maintenance)', count: data.dept_distribution?.Maintenance || 0 },
  ];

  return (
    <div className="w-full flex flex-col p-4 space-y-3 pb-2" style={{ color: '#262626' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
        <div>
          <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
            Phân Tích Vận Hành Thực Tế (Database Analytics)
          </h2>
          <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
            Thống kê trực tiếp từ cơ sở dữ liệu về phiên hội thoại, nhiệm vụ và điều phối nhân sự hỗ trợ
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors self-start sm:self-auto"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#BFBFBD',
            color: '#262626',
          }}
        >
          {isLoading ? 'Đang cập nhật...' : 'Cập nhật số liệu'}
        </button>
      </div>

      {/* 4 Top Metric Cards (100% Real Database Data) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Chat Sessions */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            PHIÊN TƯƠNG TÁC ROBOT
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {data.total_sessions}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>phiên</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            Tổng {data.total_messages} lượt trao đổi
          </div>
        </div>

        {/* Card 2: Service Tasks */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            YÊU CẦU DỊCH VỤ PHÁT SINH
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {data.total_tasks}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>phiếu</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            {data.active_tasks} đang xử lý • {data.completed_tasks} hoàn tất
          </div>
        </div>

        {/* Card 3: Staff Roster & Escalation */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            NHÂN SỰ ĐIỀU PHỐI
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {data.total_staff}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>nhân sự</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            {data.fallback_staff} nhân sự tiếp nhận bàn giao Robot
          </div>
        </div>

        {/* Card 4: Dispatch Mode */}
        <div
          className="p-3 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>
            TỶ LỆ PHÂN BỔ NHIỆM VỤ
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-2xl font-bold" style={{ color: '#262626' }}>
              {data.human_tasks}
            </span>
            <span className="text-xs" style={{ color: '#8C8C8C' }}>/ {data.total_tasks} việc</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>
            {data.robot_assigned_tasks} Robot • {data.human_tasks} Nhân sự hỗ trợ
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Department Distribution) | Right (Recent Real Activities) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* Left Column (5 cols): Department Breakdown */}
        <div
          className="lg:col-span-5 p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
            <div className="text-xs font-bold" style={{ color: '#262626' }}>
              Phân bổ công việc theo 5 bộ phận
            </div>
            <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
              Tỷ lệ khối lượng yêu cầu dịch vụ thực tế trong CSDL
            </div>
          </div>

          <div className="space-y-2 text-xs">
            {deptEntries.map((dept) => {
              const pct = Math.round((dept.count / totalTasks) * 100);
              return (
                <div key={dept.name} className="space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-medium" style={{ color: '#262626' }}>
                      {dept.name}
                    </span>
                    <span className="font-mono font-semibold" style={{ color: '#8C8C8C' }}>
                      {dept.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E9E5DC' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(pct, dept.count > 0 ? 4 : 0)}%`,
                        backgroundColor: '#262626',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="p-2 rounded border text-[11px] flex justify-between items-center"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <span className="font-medium" style={{ color: '#262626' }}>
              Tổng số yêu cầu đã ghi nhận:
            </span>
            <span className="font-bold font-mono" style={{ color: '#262626' }}>
              {data.total_tasks}
            </span>
          </div>
        </div>

        {/* Right Column (7 cols): Recent Real Activities */}
        <div
          className="lg:col-span-7 p-3.5 rounded-xl border flex flex-col justify-between"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
        >
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
            <div>
              <span className="text-xs font-bold" style={{ color: '#262626' }}>
                Nhật ký yêu cầu gần đây nhất
              </span>
              <div className="text-[10px]" style={{ color: '#8C8C8C' }}>
                Dữ liệu thực từ các bảng nghiệp vụ và robot điều phối
              </div>
            </div>
            <span className="text-[11px] font-mono" style={{ color: '#8C8C8C' }}>
              Database Live
            </span>
          </div>

          <div className="overflow-x-auto my-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-[10px] font-semibold uppercase" style={{ color: '#8C8C8C' }}>
                  <th className="py-2">Mã</th>
                  <th className="py-2">Nội dung</th>
                  <th className="py-2">Bộ phận</th>
                  <th className="py-2">Vị trí</th>
                  <th className="py-2 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]" style={{ borderColor: '#E9E5DC' }}>
                {data.recent_activities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs" style={{ color: '#8C8C8C' }}>
                      Chưa có yêu cầu nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  data.recent_activities.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F2EFE9]/40 transition-colors">
                      <td className="py-2 font-mono font-semibold" style={{ color: '#262626' }}>
                        {item.id}
                      </td>
                      <td className="py-2 font-medium truncate max-w-[200px]" style={{ color: '#262626' }}>
                        {item.title}
                      </td>
                      <td className="py-2">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-medium border inline-block"
                          style={{
                            backgroundColor: '#E9E5DC',
                            borderColor: '#BFBFBD',
                            color: '#262626',
                          }}
                        >
                          {item.department}
                        </span>
                      </td>
                      <td className="py-2" style={{ color: '#8C8C8C' }}>
                        {item.location}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-medium border inline-block"
                          style={{
                            backgroundColor: item.status === 'Completed' ? '#262626' : '#FFFFFF',
                            color: item.status === 'Completed' ? '#F2EFE9' : '#262626',
                            borderColor: '#BFBFBD',
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t text-[10px] flex justify-between" style={{ borderColor: '#E9E5DC', color: '#8C8C8C' }}>
            <span>Đồng bộ từ CSDL Supabase PostgreSQL</span>
            <span>Khởi chạy tự động</span>
          </div>
        </div>
      </div>
    </div>
  );
};
