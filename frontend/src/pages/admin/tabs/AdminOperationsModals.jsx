import React from 'react';
import { User, Bot, Sparkles, Send } from 'lucide-react';

export const AdminTaskDetailModal = ({ selectedTask, onClose, t }) => {
  if (!selectedTask) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
              <span>{t('opsModalTaskDetailTitle').replace('{id}', selectedTask.id)}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedTask.department}
              </span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {t('opsModalLocationGuest')
                .replace('{location}', selectedTask.location)
                .replace('{guest}', selectedTask.guest_name)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
            <div className="font-extrabold text-stone-900 text-sm">{selectedTask.title}</div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
              <span>{t('opsModalSource')}: <strong>{selectedTask.source}</strong></span>
              <span>•</span>
              <span>{t('opsModalCreatedAt')}: <strong>{selectedTask.time || selectedTask.created_at}</strong></span>
            </div>
          </div>

          {/* Status & Location Display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                {t('opsModalCurrentStatus')}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-stone-200 text-stone-800">
                {selectedTask.status}
              </span>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                {t('opsModalRoomLocation')}
              </span>
              <span className="text-xs font-bold text-stone-900">
                {selectedTask.location}
              </span>
            </div>
          </div>

          {/* Assigned Staff Display */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {t('opsModalAssignedStaff')}
            </span>
            <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>{selectedTask.assigned_to || t('opsModalUnassignedStaff')}</span>
            </span>
          </div>

          {/* Assigned Robot Display */}
          {selectedTask.assigned_robot && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                {t('opsModalAssignedRobot')}
              </span>
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-stone-600" />
                <span>{selectedTask.assigned_robot}</span>
              </span>
            </div>
          )}

          {/* Note Display */}
          {selectedTask.notes && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                {t('opsModalGuestNotes')}
              </span>
              <p className="text-xs text-stone-700 leading-relaxed font-medium">
                {selectedTask.notes}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white transition-all cursor-pointer shadow-sm"
            >
              {t('opsModalClose')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminDispatchTaskModal = ({
  isOpen,
  onClose,
  dispatchForm,
  setDispatchForm,
  onSubmit,
  isSubmitting,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white p-6 rounded-3xl border border-stone-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>{t('opsCreateDispatchTitle')}</span>
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 flex items-center justify-center font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Department Selection */}
          <div>
            <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
              {t('opsDispatchDeptLabel')}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {['Reception', 'Housekeeping', 'F&B', 'Bell Services', 'Maintenance', 'Concierge', 'Taxi', 'Directive'].map(
                (d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDispatchForm({ ...dispatchForm, department: d })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                      dispatchForm.department === d
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {d}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
              {t('opsDispatchTitleLabel')}
            </label>
            <input
              type="text"
              required
              value={dispatchForm.title}
              onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
              placeholder={t('opsDispatchTitlePlaceholder')}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Location & Guest Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                {t('opsDispatchRoomLabel')}
              </label>
              <input
                type="text"
                required
                value={dispatchForm.room_number}
                onChange={(e) => setDispatchForm({ ...dispatchForm, room_number: e.target.value })}
                placeholder={t('opsDispatchRoomPlaceholder')}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                {t('opsDispatchGuestLabel')}
              </label>
              <input
                type="text"
                value={dispatchForm.guest_name}
                onChange={(e) => setDispatchForm({ ...dispatchForm, guest_name: e.target.value })}
                placeholder={t('opsDispatchGuestPlaceholder')}
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Assign to Robot */}
          <div>
            <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
              {t('opsDispatchRobotLabel')}
            </label>
            <select
              value={dispatchForm.assigned_robot_code}
              onChange={(e) =>
                setDispatchForm({ ...dispatchForm, assigned_robot_code: e.target.value })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="RC-001">{t('opsDispatchRobotOpt1')}</option>
              <option value="Bot Unit Alpha">{t('opsDispatchRobotOpt2')}</option>
              <option value="">{t('opsDispatchRobotOptNone')}</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
              {t('opsDispatchNotesLabel')}
            </label>
            <textarea
              rows={2}
              value={dispatchForm.description}
              onChange={(e) => setDispatchForm({ ...dispatchForm, description: e.target.value })}
              placeholder={t('opsDispatchNotesPlaceholder')}
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
            >
              {t('opsModalClose')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? t('opsDispatchSubmitting') : t('opsDispatchSubmit')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
