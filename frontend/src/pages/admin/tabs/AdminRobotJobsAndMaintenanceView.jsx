import React from 'react';
import { History, Plus, CheckCircle2, Play, Trash2, Edit3, Eye, AlertTriangle, Clock } from 'lucide-react';
import { COMPONENT_OPTIONS } from './adminRobotManagementUtils';

export const AdminRobotJobsAndMaintenanceView = ({
  activeView, isEN, jobStatusFilter, setJobStatusFilter, jobTriggerFilter, setJobTriggerFilter, jobsData, formatDateTime, isLoadingJobDetail, handleViewJobDetail, maintStatusFilter, setMaintStatusFilter, maintComponentFilter, setMaintComponentFilter, maintData, openCreateMaintModal, openEditMaintModal, getComponentLabel, getMaintTypeLabel, handleQuickMaintStatus, handleDeleteMaint,
}) => (
  <>
        {/* ============================================================
            VIEW 2: REAL ROBOT JOB EXECUTION HISTORY
           ============================================================ */}
        {activeView === 'history' && (
          <div className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: '#BFBFBD' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  {isEN ? 'Real Job Execution History (RC-001)' : 'Lịch sử Job Chạy Thực Tế của Robot RC-001'}
                </h3>
                <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  {isEN
                    ? 'Automatically recorded whenever workflows or missions are dispatched to RC-001.'
                    : 'Tự động ghi nhận mỗi lần phát lệnh quy trình (Workflow) hoặc nhiệm vụ tới RC-001.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={jobStatusFilter}
                  onChange={(e) => setJobStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="ALL">{isEN ? 'All Statuses' : 'Tất cả trạng thái'}</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="RUNNING">RUNNING</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <select
                  value={jobTriggerFilter}
                  onChange={(e) => setJobTriggerFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="ALL">{isEN ? 'All Triggers' : 'Tất cả nguồn'}</option>
                  <option value="MANUAL">MANUAL</option>
                  <option value="AUTO_DETECT">AUTO_DETECT</option>
                  <option value="SCHEDULE">SCHEDULE</option>
                  <option value="VOICE">VOICE</option>
                  <option value="GUEST_TAP">GUEST_TAP</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold uppercase border-b" style={{ borderColor: '#E9E5DC', color: '#8C8C8C' }}>
                    <th className="py-2.5 px-2">Job Code</th>
                    <th className="py-2.5 px-2">{isEN ? 'Workflow / Task' : 'Nhiệm vụ / Kịch bản'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Trigger' : 'Nguồn'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Steps' : 'Bước'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Status' : 'Trạng thái'}</th>
                    <th className="py-2.5 px-2">{isEN ? 'Started' : 'Thời gian'}</th>
                    <th className="py-2.5 px-2 text-right">{isEN ? 'Details' : 'Chi tiết'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#E9E5DC' }}>
                  {jobsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        {isEN ? 'No job execution records yet. Dispatch a workflow to record one.' : 'Chưa có bản ghi Job nào. Hãy phát lệnh một kịch bản ở mục Quản lý Quy trình.'}
                      </td>
                    </tr>
                  ) : (
                    jobsData.items.map((job) => (
                      <tr key={job.id} className="hover:bg-[#F2EFE9]/60">
                        <td className="py-2.5 px-2 font-mono font-bold whitespace-nowrap">{job.job_code}</td>
                        <td className="py-2.5 px-2 font-medium max-w-[260px] truncate">{job.title}</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono border bg-[#F2EFE9]" style={{ borderColor: '#BFBFBD' }}>
                            {job.trigger_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-mono">
                          {job.current_step_index}/{job.total_steps}
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              job.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : job.status === 'FAILED'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-[11px] whitespace-nowrap" style={{ color: '#8C8C8C' }}>
                          {formatDateTime(job.started_at || job.created_at)}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewJobDetail(job.id)}
                            disabled={isLoadingJobDetail}
                            className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer hover:bg-[#E9E5DC] inline-flex items-center gap-1"
                            style={{ borderColor: '#BFBFBD' }}
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isEN ? 'View' : 'Xem'}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================
            VIEW 3: ROBOT MAINTENANCE SCHEDULES
           ============================================================ */}
        {activeView === 'maintenance' && (
          <div className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: '#BFBFBD' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  {isEN ? 'Robot Hardware & Software Maintenance Schedule' : 'Lịch Bảo Trì & Kiểm Tra Định Kỳ RC-001'}
                </h3>
                <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  {isEN
                    ? 'Track preventive checks, calibration & repairs; recurring items auto-schedule upon completion.'
                    : 'Theo dõi lịch kiểm tra LiDAR, hiệu chỉnh pin, cơ khí; tự động lên lịch kỳ tiếp theo khi hoàn tất.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={maintStatusFilter}
                  onChange={(e) => setMaintStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="all">{isEN ? 'All Statuses' : 'Tất cả trạng thái'}</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Completed">Completed</option>
                </select>
                <select
                  value={maintComponentFilter}
                  onChange={(e) => setMaintComponentFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white font-semibold"
                  style={{ borderColor: '#BFBFBD' }}
                >
                  <option value="all">{isEN ? 'All Components' : 'Tất cả bộ phận'}</option>
                  {COMPONENT_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{isEN ? c.en : c.vi}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openCreateMaintModal}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#262626] text-white hover:bg-black cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEN ? 'Schedule Maintenance' : 'Thêm lịch bảo trì'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {maintData.items.length === 0 ? (
                <div className="py-10 text-center text-xs rounded-xl border border-dashed" style={{ borderColor: '#BFBFBD', color: '#8C8C8C' }}>
                  {isEN ? 'No maintenance schedules found.' : 'Chưa có lịch bảo trì nào khớp bộ lọc.'}
                </div>
              ) : (
                maintData.items.map((item) => {
                  const isOverdue = item.status === 'Overdue';
                  const isCompleted = item.status === 'Completed';
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      style={{
                        borderColor: isOverdue ? '#FCA5A5' : '#BFBFBD',
                        backgroundColor: isOverdue ? '#FEF2F2' : '#FFFFFF',
                      }}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isOverdue
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : item.status === 'In Progress'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-[#F2EFE9] text-[#262626] border-[#BFBFBD]'
                            }`}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {item.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-[#E9E5DC]" style={{ borderColor: '#BFBFBD' }}>
                            {getComponentLabel(item.component)}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                            {getMaintTypeLabel(item.maintenance_type)} · {item.priority}
                          </span>
                          {item.interval_days && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200">
                              {isEN ? `Every ${item.interval_days}d` : `Chu kỳ ${item.interval_days} ngày`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold">{item.title}</div>
                        {item.notes && (
                          <div className="text-[11px]" style={{ color: '#525252' }}>{item.notes}</div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: '#8C8C8C' }}>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {isEN ? 'Scheduled:' : 'Dự kiến:'} {formatDateTime(item.scheduled_date)}
                          </span>
                          {item.completed_date && (
                            <span>{isEN ? 'Completed:' : 'Hoàn thành:'} {formatDateTime(item.completed_date)}</span>
                          )}
                          {item.assigned_technician && (
                            <span>{isEN ? 'Tech:' : 'Phụ trách:'} {item.assigned_technician}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isCompleted && item.status !== 'In Progress' && (
                          <button
                            type="button"
                            onClick={() => handleQuickMaintStatus(item, 'In Progress')}
                            className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer hover:bg-[#E9E5DC] inline-flex items-center gap-1"
                            style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF' }}
                          >
                            <Play className="w-3 h-3" />
                            <span>{isEN ? 'Start' : 'Bắt đầu'}</span>
                          </button>
                        )}
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleQuickMaintStatus(item, 'Completed')}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer bg-[#262626] text-white hover:bg-black inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isEN ? 'Complete' : 'Hoàn thành'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditMaintModal(item)}
                          className="p-1.5 rounded-lg border cursor-pointer hover:bg-[#E9E5DC]"
                          style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF' }}
                          title={isEN ? 'Edit' : 'Sửa'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaint(item)}
                          className="p-1.5 rounded-lg border cursor-pointer hover:bg-red-50 hover:text-red-700"
                          style={{ borderColor: '#BFBFBD', backgroundColor: '#FFFFFF', color: '#8C8C8C' }}
                          title={isEN ? 'Delete' : 'Xóa'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
  </>
);
