import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  PlusCircle,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  Bot,
  Shield,
  Trash2,
  Edit3,
  Sparkles,
  Sliders,
  Bell,
  Radio,
  ExternalLink,
  ChevronDown,
  Building2,
  Utensils,
  BedDouble,
  HeartPulse,
  Wrench,
} from 'lucide-react';
import { Pagination } from '../../../components/common/Pagination';
import {
  fetchStaffRoster,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from '../../../services/staffApi';


export const AdminStaffTab = ({ currentUser = {} }) => {
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [notification, setNotification] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Modals
  const [selectedStaff, setSelectedStaff] = useState(null); // for detail/edit modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit Staff State
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: '',
    department: 'Reception',
    status: 'available',
    phone: '',
    email: '',
    shift: 'Morning Shift (06:00 - 14:00)',
    location: 'Main Hotel',
    is_fallback_agent: false,
    assigned_floors: 'Floor 1 - 5',
    notification_channels: 'Web Dashboard, Tablet Alert',
  });

  // Add Staff State
  const [addForm, setAddForm] = useState({
    username: '',
    password: '123456',
    full_name: '',
    role: 'Front Desk Agent',
    department: 'Reception',
    phone: '+84 90 123 4567',
    email: '',
    shift: 'Morning Shift (06:00 - 14:00)',
    location: 'Main Lobby Front Desk',
    is_fallback_agent: false,
    assigned_floors: 'Floor 1 - 5',
  });

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await fetchStaffRoster();
      setStaffList(data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách nhân viên:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleOpenDetailModal = (staff) => {
    setSelectedStaff(staff);
    setEditForm({
      full_name: staff.full_name || '',
      role: staff.role || '',
      department: staff.department || 'Reception',
      status: staff.status || 'available',
      phone: staff.phone || '+84 90 123 4567',
      email: staff.email || `${staff.username || 'staff'}@aurora.hotel`,
      shift: staff.shift || 'Morning Shift (06:00 - 14:00)',
      location: staff.location || 'Main Hotel',
      is_fallback_agent: !!staff.is_fallback_agent,
      assigned_floors: staff.assigned_floors || 'Floor 1 - 5',
      notification_channels: staff.notification_channels || 'Web Dashboard, Tablet Alert',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      setIsLoading(true);
      await updateStaffMember(selectedStaff.id, editForm);
      showNotification(`Đã cập nhật cấu hình cho ${editForm.full_name}!`);
      setSelectedStaff(null);
      await loadStaff();
    } catch (err) {
      showNotification('Lỗi khi cập nhật nhân viên: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await createStaffMember({
        ...addForm,
        email: addForm.email || `${addForm.username}@aurora.hotel`,
      });
      showNotification(`Đã tạo tài khoản nhân viên ${addForm.full_name} thành công!`);
      setIsAddModalOpen(false);
      setAddForm({
        username: '',
        password: '123456',
        full_name: '',
        role: 'Front Desk Agent',
        department: 'Reception',
        phone: '+84 90 123 4567',
        email: '',
        shift: 'Morning Shift (06:00 - 14:00)',
        location: 'Main Lobby Front Desk',
        is_fallback_agent: false,
        assigned_floors: 'Floor 1 - 5',
      });
      await loadStaff();
    } catch (err) {
      showNotification('Lỗi tạo nhân viên: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (staffId, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân sự ${name}?`)) return;
    try {
      await deleteStaffMember(staffId);
      showNotification(`Đã xóa nhân viên ${name}!`);
      if (selectedStaff?.id === staffId) setSelectedStaff(null);
      await loadStaff();
    } catch (err) {
      showNotification('Lỗi khi xóa: ' + err.message);
    }
  };

  // Filters
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      (s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept =
      departmentFilter === 'All' ||
      (s.department || '').toLowerCase() === departmentFilter.toLowerCase();

    const matchesStatus =
      statusFilter === 'All' ||
      (s.status || '').toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, statusFilter]);

  const paginatedStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getDeptColor = (dept = '') => {
    const d = dept.toLowerCase();
    if (d.includes('reception') || d.includes('front')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (d.includes('housekeep')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (d.includes('f&b') || d.includes('room')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (d.includes('bell')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (d.includes('maint')) return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-stone-100 text-stone-700 border-stone-200';
  };

  const getStatusBadge = (status = '') => {
    const s = status.toLowerCase();
    if (s === 'available' || s === 'on duty') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Available</span>
        </span>
      );
    }
    if (s === 'busy') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Busy (1 Active)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
        <span>Off Duty</span>
      </span>
    );
  };

  return (
    <div className="w-full min-h-full flex flex-col p-6 space-y-6 pb-16">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">{notification}</span>
        </div>
      )}

      {/* 1. Header (Matching Figma Left Screen) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            Danh Bạ & Phân Công Nhân Sự (Staff Directory)
          </h2>
          <p className="text-sm text-stone-500 font-medium">
            Quản lý đội ngũ nhân sự 5 phòng ban, ca trực và cấu hình điều phối khi Robot chuyển tiếp cuộc gọi
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-indigo-400" />
          <span>+ Add Staff Member</span>
        </button>
      </div>

      {/* 2. Controls: Search & Dropdown Filters (Matching Figma) */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, email or role..."
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
          >
            <option value="All">All Departments</option>
            <option value="Reception">Front Desk (Reception)</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="F&B">F&B / Room Service</option>
            <option value="Bell Services">Bell Services</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Administration">Administration</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="available">Available (Sẵn sàng)</option>
            <option value="busy">Busy (Đang bận)</option>
            <option value="off_shift">Off Duty (Hết ca)</option>
          </select>
        </div>
      </div>

      {/* 3. Staff Table (Matching Figma Left Screen) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-[11px] font-black text-stone-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">STAFF MEMBER</th>
                <th className="py-3.5 px-4">DEPARTMENT</th>
                <th className="py-3.5 px-4">ROLE</th>
                <th className="py-3.5 px-4">AVAILABILITY</th>
                <th className="py-3.5 px-4">ROBOT ESCALATION</th>
                <th className="py-3.5 px-4">ASSIGNED TASKS</th>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400 font-medium">
                    Không tìm thấy nhân viên nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((staff) => {
                  const avatar =
                    staff.avatar_url ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${staff.code || staff.id}`;
                  const email = staff.email || `${staff.username || 'staff'}@aurora.hotel`;

                  return (
                    <tr key={staff.id} className="hover:bg-stone-50/60 transition-colors">
                      {/* Member Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={avatar}
                            alt={staff.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-stone-200 shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-stone-900 flex items-center gap-1.5">
                              <span>{staff.full_name}</span>
                              <span className="text-[10px] text-stone-400 font-mono font-normal">
                                ({staff.code || 'STF'})
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-500">{email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getDeptColor(
                            staff.department
                          )}`}
                        >
                          <span>{staff.department}</span>
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 font-medium text-stone-700">{staff.role}</td>

                      {/* Availability */}
                      <td className="py-3.5 px-4">{getStatusBadge(staff.status)}</td>

                      {/* Robot Escalation Status */}
                      <td className="py-3.5 px-4">
                        {staff.is_fallback_agent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Bot className="w-3 h-3 text-indigo-600" />
                            <span>Fallback Agent</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400 font-medium">Standard</span>
                        )}
                      </td>

                      {/* Tasks */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-stone-700">
                          {staff.current_tasks_count || 0} Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleOpenDetailModal(staff)}
                          className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-indigo-50 text-stone-700 hover:text-indigo-600 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Configure</span>
                        </button>
                        <button
                          onClick={() => handleDelete(staff.id, staff.full_name)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer inline-flex items-center"
                          title="Xóa nhân viên"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredStaff.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* 4. MODAL: STAFF DETAIL & ROBOT ESCALATION CONFIGURATION (Matching Right Screen Figma) */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-4">
                <img
                  src={
                    selectedStaff.avatar_url ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedStaff.code}`
                  }
                  alt={selectedStaff.full_name}
                  className="w-14 h-14 rounded-2xl object-cover border border-stone-200 shadow-sm"
                />
                <div>
                  <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                    <span>{selectedStaff.full_name}</span>
                    <span className="text-xs text-stone-400 font-mono font-normal">
                      ({selectedStaff.code || selectedStaff.id})
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-600 font-bold mt-0.5">
                    {selectedStaff.role} • {selectedStaff.department}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStaff(null)}
                className="w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-500 hover:bg-stone-100 flex items-center justify-center font-bold text-xs cursor-pointer shadow-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* SECTION 1: Employment Overview (Figma) */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-stone-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 pb-2">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1. Employment Overview</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      DEPARTMENT:
                    </label>
                    <select
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-800 focus:outline-none"
                    >
                      <option value="Reception">Front Desk (Reception)</option>
                      <option value="Housekeeping">Housekeeping</option>
                      <option value="F&B">F&B / Room Service</option>
                      <option value="Bell Services">Bell Services</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Administration">Administration</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      WORKING SHIFT:
                    </label>
                    <input
                      type="text"
                      value={editForm.shift}
                      onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">PHONE:</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">EMAIL:</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Robot Escalation Configuration (Figma Right Screen) */}
              <div className="space-y-4 pt-2">
                <h4 className="text-[11px] font-black text-stone-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 pb-2">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                  <span>2. Robot Escalation Configuration</span>
                </h4>

                {/* Fallback Agent Toggle */}
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <p className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>FALLBACK RECEPTION AGENT</span>
                    </p>
                    <p className="text-[11px] text-stone-500 leading-tight">
                      Khi Robot Concierge cần sự hỗ trợ của con người, hệ thống sẽ tự động định tuyến
                      thông báo và cuộc gọi tới nhân viên này.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={editForm.is_fallback_agent}
                      onChange={(e) =>
                        setEditForm({ ...editForm, is_fallback_agent: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Assigned Floors & Notification Channels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      ASSIGNED FLOORS / SUITES:
                    </label>
                    <input
                      type="text"
                      value={editForm.assigned_floors}
                      onChange={(e) => setEditForm({ ...editForm, assigned_floors: e.target.value })}
                      placeholder="Floor 1 - 5 (Lobby & Lower Suites)"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      NOTIFICATION CHANNELS:
                    </label>
                    <input
                      type="text"
                      value={editForm.notification_channels}
                      onChange={(e) =>
                        setEditForm({ ...editForm, notification_channels: e.target.value })
                      }
                      placeholder="Web Dashboard, Tablet Alert, Radio"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Active Task History (Figma) */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-black text-stone-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 pb-2">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <span>3. Active Tasks History</span>
                </h4>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-stone-900">
                    <span>Late Check-in Guest Escort (Room 302)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      In Progress
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Chỉ định từ Robot Concierge RC-001 • Nhận lúc 21:40
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedStaff(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADD NEW STAFF MEMBER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                <span>Thêm Nhân Sự Khách Sạn Mới</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  HỌ VÀ TÊN NHÂN VIÊN:
                </label>
                <input
                  type="text"
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="Ví dụ: Sarah Jenkins, Nguyễn Văn An..."
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    TÊN ĐĂNG NHẬP:
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    placeholder="sarah_j"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    MẬT KHẨU BAN ĐẦU:
                  </label>
                  <input
                    type="password"
                    required
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="123456"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    PHÒNG BAN:
                  </label>
                  <select
                    value={addForm.department}
                    onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="Reception">Front Desk (Lễ tân)</option>
                    <option value="Housekeeping">Housekeeping (Buồng phòng)</option>
                    <option value="F&B">F&B / Room Service</option>
                    <option value="Bell Services">Bell Services (Hành lý)</option>
                    <option value="Maintenance">Maintenance (Kỹ thuật)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    VỊ TRÍ / CHỨC DANH:
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    placeholder="Senior Agent / Lead"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    SỐ ĐIỆN THOẠI:
                  </label>
                  <input
                    type="text"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="+84 90 123 4567"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    CA TRỰC:
                  </label>
                  <input
                    type="text"
                    value={addForm.shift}
                    onChange={(e) => setAddForm({ ...addForm, shift: e.target.value })}
                    placeholder="Ca Sáng (06:00 - 14:00)"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'Đang tạo...' : 'Tạo Nhân Sự'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
