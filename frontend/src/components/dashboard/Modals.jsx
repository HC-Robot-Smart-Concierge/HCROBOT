import React, { useState } from 'react';
import { X, Check, Bot, User, MapPin, Sparkles, Navigation, Layers, ShieldCheck } from 'lucide-react';

// 1. Modal: Phân công nhân sự hoặc Robot HCRobot
export const AssignStaffModal = ({
  isOpen,
  onClose,
  task = null,
  staffList = [],
  robotUnits = [],
  onAssign = () => {},
}) => {
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedRobot, setSelectedRobot] = useState(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  if (!isOpen || !task) return null;

  const handleConfirm = () => {
    if (selectedStaff) {
      onAssign(task.id, { type: 'staff', name: selectedStaff.name });
    } else if (selectedRobot) {
      onAssign(task.id, { type: 'robot', name: selectedRobot.name });
    }
    onClose();
  };

  const handleAiAutoDispatch = () => {
    setIsAutoAssigning(true);
    setTimeout(() => {
      setIsAutoAssigning(false);
      onAssign(task.id, { type: 'robot', name: 'HCRobot Unit 01 (Optimal Route)' });
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#FAF8F5] w-full max-w-lg rounded-3xl shadow-2xl border border-[#E0DCD3] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE6DE] flex items-center justify-between bg-white/70">
          <div>
            <h3 className="text-sm font-bold text-[#1A1917]">Assign Task / Service</h3>
            <p className="text-xs text-[#78716C]">
              {task.id} • {task.title || task.room || 'Task'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-200 text-[#78716C] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* AI Smart Dispatch Recommendation */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-sky-950">AI Smart Auto-Dispatch</p>
                <p className="text-[11px] text-sky-700">Assign optimal HCRobot unit based on nearest elevator</p>
              </div>
            </div>
            <button
              onClick={handleAiAutoDispatch}
              disabled={isAutoAssigning}
              className="px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isAutoAssigning ? 'Dispatching...' : 'Auto Dispatch'}</span>
            </button>
          </div>

          {/* Available HCRobot Units */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716C] mb-2.5 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-sky-600" />
              <span>Autonomous HCRobot Units</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(robotUnits.length > 0
                ? robotUnits
                : [
                    { id: 'u1', name: 'Unit 01 (F&B Delivery)', status: 'Available', location: 'Dock 1' },
                    { id: 'u2', name: 'Unit 02 (Service Cart)', status: 'Available', location: 'Floor 3' },
                  ]
              ).map((bot) => {
                const isSelected = selectedRobot?.id === bot.id;
                return (
                  <div
                    key={bot.id}
                    onClick={() => {
                      setSelectedRobot(bot);
                      setSelectedStaff(null);
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/50 shadow-sm'
                        : 'border-[#E5E1D8] bg-white hover:bg-[#F5F2EB]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                        🤖
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1A1917]">{bot.name}</p>
                        <p className="text-[10px] text-emerald-600 font-medium">{bot.status} • {bot.location}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* On-Duty Human Staff */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716C] mb-2.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-stone-600" />
              <span>Available Staff Members</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(staffList.length > 0
                ? staffList
                : [
                    { id: 's1', name: 'Maria Santos', location: 'Floor 3', role: 'Staff' },
                    { id: 's2', name: 'James Doe', location: 'Floor 5', role: 'Staff' },
                  ]
              ).map((staff) => {
                const isSelected = selectedStaff?.id === staff.id;
                return (
                  <div
                    key={staff.id}
                    onClick={() => {
                      setSelectedStaff(staff);
                      setSelectedRobot(null);
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-[#18181B] bg-stone-100 shadow-sm'
                        : 'border-[#E5E1D8] bg-white hover:bg-[#F5F2EB]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center font-bold text-xs">
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1A1917]">{staff.name}</p>
                        <p className="text-[10px] text-stone-500 font-medium">{staff.location || 'On Shift'}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#18181B]" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-100/80 border-t border-[#EAE6DE] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedStaff && !selectedRobot}
            className="px-5 py-2 rounded-full bg-[#18181B] disabled:opacity-40 hover:bg-black text-white text-xs font-bold transition-all shadow-sm"
          >
            Confirm Assignment
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. Modal: Tạo chỉ thị mới / Yêu cầu bảo trì / Phục vụ
export const NewDirectiveModal = ({ isOpen, onClose, onSubmit = () => {} }) => {
  const [department, setDepartment] = useState('Housekeeping');
  const [priority, setPriority] = useState('HIGH PRIORITY');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title) return;
    onSubmit({
      title,
      department,
      priority,
      location: location || 'General Area',
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#FAF8F5] w-full max-w-lg rounded-3xl shadow-2xl border border-[#E0DCD3] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EAE6DE] flex items-center justify-between bg-white/70">
          <div>
            <h3 className="text-sm font-bold text-[#1A1917]">Create New Directive / Task</h3>
            <p className="text-xs text-[#78716C]">Dispatch work order across hotel operational units</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-stone-200 text-[#78716C]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E0DCD3] text-xs font-semibold text-stone-800 outline-none focus:border-stone-500"
              >
                <option value="Housekeeping">Housekeeping</option>
                <option value="Room Service">Room Service / F&B</option>
                <option value="Bell Services">Bell Services</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E0DCD3] text-xs font-semibold text-stone-800 outline-none focus:border-stone-500"
              >
                <option value="HIGH PRIORITY">High Priority / Urgent</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
              Directive / Request Title
            </label>
            <input
              type="text"
              placeholder="e.g. Spill cleanup in East Lobby or Deep clean Suite 501"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E0DCD3] text-xs font-medium text-stone-800 outline-none focus:border-stone-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
              Location / Room
            </label>
            <input
              type="text"
              placeholder="e.g. Room 412, Floor 5, Grand Ballroom"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E0DCD3] text-xs font-medium text-stone-800 outline-none focus:border-stone-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
              Detailed Instructions
            </label>
            <textarea
              rows={3}
              placeholder="Add specific guest requests, special materials or robot delivery notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E0DCD3] text-xs font-medium text-stone-800 outline-none focus:border-stone-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all shadow-sm"
            >
              Issue Directive
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Modal: Interactive 3D Floor & Fleet Map
export const InteractiveMapModal = ({ isOpen, onClose, title = 'Interactive Facility Map' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="bg-[#FAF8F5] w-full max-w-3xl rounded-3xl shadow-2xl border border-[#E0DCD3] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EAE6DE] flex items-center justify-between bg-white/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1A1917]">{title}</h3>
              <p className="text-xs text-[#78716C]">Floor 5 & Active HCRobot Fleets Navigation Grid</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-stone-200 text-[#78716C]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Simulated 3D Blueprint Canvas */}
          <div className="w-full h-80 rounded-2xl bg-stone-900 border border-stone-800 relative overflow-hidden flex items-center justify-center p-4">
            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />

            {/* Simulated Hotel Floor Plan */}
            <div className="relative z-10 w-full h-full border border-stone-700 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="px-3 py-1 rounded-full bg-stone-800 text-stone-300 text-xs font-mono border border-stone-700">
                  FLOOR 5 • WEST WING
                </span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    LIVE TELEMETRY
                  </span>
                </div>
              </div>

              {/* Floor rooms layout visualization */}
              <div className="grid grid-cols-4 gap-3 my-auto">
                <div className="h-16 rounded-lg border border-stone-700 bg-stone-800/60 p-2 relative flex flex-col justify-between">
                  <span className="text-[10px] text-stone-400 font-mono">Room 501</span>
                  <span className="text-[9px] text-emerald-400">Cleaned</span>
                </div>
                <div className="h-16 rounded-lg border-2 border-red-500 bg-red-950/40 p-2 relative flex flex-col justify-between">
                  <span className="text-[10px] text-red-300 font-mono">Room 502</span>
                  <span className="text-[9px] text-red-400 animate-pulse">Spill Alert</span>
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">!</span>
                </div>
                <div className="h-16 rounded-lg border border-sky-500 bg-sky-950/30 p-2 relative flex flex-col justify-between">
                  <span className="text-[10px] text-sky-300 font-mono">Room 503</span>
                  <span className="text-[9px] text-sky-400">HCRobot Deliv</span>
                </div>
                <div className="h-16 rounded-lg border border-stone-700 bg-stone-800/60 p-2 relative flex flex-col justify-between">
                  <span className="text-[10px] text-stone-400 font-mono">Room 504</span>
                  <span className="text-[9px] text-stone-400">Vacant</span>
                </div>
              </div>

              {/* Bot Position Tag */}
              <div className="flex items-center justify-between text-xs text-stone-400">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded bg-sky-600 text-white font-mono text-[10px] flex items-center gap-1">
                    <Navigation className="w-3 h-3 animate-spin" />
                    Unit 01 (Dock 1)
                  </div>
                  <div className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px]">
                    Unit 02 (Hallway 5B)
                  </div>
                </div>
                <span className="text-[11px] text-stone-500">LiDAR SLAM Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-100 border-t border-[#EAE6DE] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#18181B] text-white text-xs font-bold hover:bg-black"
          >
            Close Map
          </button>
        </div>
      </div>
    </div>
  );
};
