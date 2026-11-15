import React from 'react';
import {
  ConciergeBell,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

export const RoomServiceStatsAndFilters = ({
  st,
  stats,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categoryOptions,
  filteredCount,
  totalCount,
}) => (
  <>
    {/* KPI Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
        <p className="text-xs font-medium text-[#7D716A] uppercase tracking-wider">{st('Total services')}</p>
        <p className="text-3xl font-bold text-[#2C2420] mt-1">{stats.total}</p>
      </div>
      <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
        <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">{st('Available services')}</p>
        <p className="text-3xl font-bold text-emerald-700 mt-1">{stats.available}</p>
      </div>
      <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
        <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">{st('Paused services')}</p>
        <p className="text-3xl font-bold text-amber-700 mt-1">{stats.paused}</p>
      </div>
      <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
        <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">{st('Complimentary services')}</p>
        <p className="text-3xl font-bold text-blue-700 mt-1">{stats.free}</p>
      </div>
    </div>

    {/* Toolbar: Search & Category Pills */}
    <div className="bg-white p-4 rounded-2xl border border-[#E8E2D9] shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7D716A]" />
          <input
            type="text"
            placeholder={st('Search services or descriptions...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
          />
        </div>
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#7D716A] whitespace-nowrap">{st('Category:')}</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-xs font-semibold text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] cursor-pointer shadow-sm"
            >
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-[#7D716A] whitespace-nowrap">
            {st('Showing')} <span className="font-semibold text-[#2C2420]">{filteredCount}</span> / {totalCount} {st('services')}
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categoryOptions.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-[#4A3E3D] text-white shadow-sm'
                  : 'bg-[#F5EFEB] text-[#635750] hover:bg-[#EAE2D8]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  </>
);

export const RoomServiceCatalogTable = ({
  st,
  paginatedServices,
  formatCurrency,
  handleToggleStatus,
  handleOpenEditModal,
  setDeleteConfirm,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse text-sm">
      <thead>
        <tr className="border-b border-[#E8E2D9] bg-[#FAF8F5] text-xs font-semibold text-[#7D716A] uppercase tracking-wider">
          <th className="py-3.5 px-4">{st('Service & description')}</th>
          <th className="py-3.5 px-4">{st('Category')}</th>
          <th className="py-3.5 px-4">{st('Price & unit')}</th>
          <th className="py-3.5 px-4">{st('Service time')}</th>
          <th className="py-3.5 px-4 text-center">{st('Status')}</th>
          <th className="py-3.5 px-4 text-right">{st('Actions')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#E8E2D9]">
        {paginatedServices.map((service) => (
          <tr key={service.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
            <td className="py-4 px-4">
              <div className="flex items-center gap-3">
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="w-12 h-12 rounded-xl object-cover border border-[#E8E2D9] flex-shrink-0"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=80';
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#F5EFEB] flex items-center justify-center text-[#7D716A] border border-[#E8E2D9] flex-shrink-0">
                    <ConciergeBell className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#2C2420]">{service.name}</span>
                    {service.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EAE2D8] text-[#4A3E3D] font-medium">
                        {service.badge}
                      </span>
                    )}
                  </div>
                  {service.description && (
                    <p className="text-xs text-[#7D716A] line-clamp-1 mt-0.5 max-w-md">
                      {service.description}
                    </p>
                  )}
                  <span className="text-[10px] font-mono text-[#A89F97] mt-0.5 block">
                    {st('ID:')} {service.id}
                  </span>
                </div>
              </div>
            </td>

            <td className="py-4 px-4 whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5EFEB] text-xs font-medium text-[#4A3E3D]">
                {service.category === 'bath' && st('Towels & amenities')}
                {service.category === 'spa' && st('In-room massage')}
                {service.category === 'bedding' && st('Pillows & blankets')}
                {service.category === 'housekeeping' && st('Room cleaning')}
                {service.category === 'laundry' && st('Laundry')}
                {!['bath', 'spa', 'bedding', 'housekeeping', 'laundry'].includes(service.category) && service.category}
              </span>
            </td>

            <td className="py-4 px-4 whitespace-nowrap">
              <div className="font-semibold text-[#2C2420]">{formatCurrency(service.price)}</div>
              <div className="text-xs text-[#7D716A]">{service.unit}</div>
            </td>

            <td className="py-4 px-4 whitespace-nowrap">
              <div className="flex items-center gap-1.5 text-xs text-[#635750]">
                <Clock className="w-3.5 h-3.5 text-[#7D716A]" />
                <span>{service.prep_time} {st('min')}</span>
              </div>
            </td>

            <td className="py-4 px-4 text-center whitespace-nowrap">
              <button
                onClick={() => handleToggleStatus(service)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  service.is_available
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
                title={st('Toggle service availability')}
              >
                {service.is_available ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {st('Available')}
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    {st('Paused')}
                  </>
                )}
              </button>
            </td>

            <td className="py-4 px-4 text-right whitespace-nowrap">
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEditModal(service)}
                  className="p-1.5 rounded-lg text-[#635750] hover:text-[#2C2420] hover:bg-[#F5EFEB] transition-all"
                  title={st('Edit service')}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(service)}
                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-all"
                  title={st('Delete service')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const RoomServiceDeleteModal = ({ st, deleteConfirm, onCancel, onConfirm }) => {
  if (!deleteConfirm) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E8E2D9] max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Trash2 className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-[#2C2420]">{st('Delete room service')}</h3>
          <p className="text-sm text-[#7D716A]">
            {st('Are you sure you want to delete')}{' '}
            <span className="font-semibold text-[#2C2420]">"{deleteConfirm.name}"</span>
            {st('? This service will no longer appear on the robot or guest app.')}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-[#DDD5CA] rounded-xl text-sm font-medium text-[#635750] hover:bg-[#F5EFEB] transition-all"
          >
            {st('Cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition-all shadow-sm"
          >
            {st('Confirm deletion')}
          </button>
        </div>
      </div>
    </div>
  );
};
