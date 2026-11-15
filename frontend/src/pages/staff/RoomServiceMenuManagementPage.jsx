import { useStaffText } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { Pagination } from '../../components/common/Pagination';
import { handleNumberInputBlockExponent } from '../../utils/numberInputHelper';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ConciergeBell,
  Plus,
  RefreshCw,
  Sparkles,
  Bath,
  HeartHandshake,
  BedDouble,
  Shirt,
  X,
} from 'lucide-react';
import {
  fetchRoomServiceCatalog,
  createRoomServiceCatalogItem,
  updateRoomServiceCatalogItem,
  deleteRoomServiceCatalogItem,
  toggleRoomServiceCatalogItem,
} from '../../services/operationsApi';
import {
  RoomServiceStatsAndFilters,
  RoomServiceCatalogTable,
  RoomServiceDeleteModal,
} from './RoomServiceMenuTableAndDelete';

export const RoomServiceMenuManagementPage = ({ currentUser, onNotify = () => {} }) => {
  const st = useStaffText();
  const staffName = currentUser?.full_name || currentUser?.name || 'Nhân Viên Phục Vụ Phòng';

  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'bath',
    price: 0,
    unit: 'Chiếc',
    prep_time: 10,
    badge: 'Miễn phí',
    description: '',
    image_url: '',
    display_order: 1,
    is_available: true,
  });

  const CATEGORY_OPTIONS = [
    { id: 'all', name: st("All categories"), icon: Sparkles },
    { id: 'bath', name: st("Towels & amenities"), icon: Bath },
    { id: 'spa', name: st("In-room massage"), icon: HeartHandshake },
    { id: 'bedding', name: st("Pillows & blankets"), icon: BedDouble },
    { id: 'housekeeping', name: st("Room cleaning"), icon: ConciergeBell },
    { id: 'laundry', name: st("Laundry"), icon: Shirt },
  ];

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchRoomServiceCatalog();
      if (Array.isArray(data)) {
        // Loại bỏ triệt để các dịch vụ nước khoáng nếu còn sót
        const cleaned = data.filter(
          (s) => !s.name?.toLowerCase().includes('nước khoáng') && !s.name?.toLowerCase().includes('nuoc khoang')
        );
        setServices(cleaned);
      }
    } catch {
      onNotify(st("Unable to load the service catalog."));
    } finally {
      setIsLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // KPIs
  const stats = useMemo(() => {
    const total = services.length;
    const available = services.filter((s) => s.is_available).length;
    const paused = total - available;
    const free = services.filter((s) => Number(s.price) === 0).length;
    return { total, available, paused, free };
  }, [services]);

  // Filtered Services
  const filteredServices = useMemo(() => {
    return services.filter((item) => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.badge?.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [services, selectedCategory, searchQuery]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, currentPage, pageSize]);

  const handleOpenCreateModal = () => {
    setEditingService(null);
    setFormData({
      name: '',
      category: 'bath',
      price: 0,
      unit: 'Chiếc',
      prep_time: 10,
      badge: 'Miễn phí',
      description: '',
      image_url: '',
      display_order: services.length + 1,
      is_available: true,
    });
    setServiceModalOpen(true);
  };

  const handleOpenEditModal = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      category: service.category || 'bath',
      price: Number(service.price) || 0,
      unit: service.unit || 'Chiếc',
      prep_time: Number(service.prep_time) || 10,
      badge: service.badge || '',
      description: service.description || '',
      image_url: service.image_url || '',
      display_order: Number(service.display_order) || 1,
      is_available: service.is_available ?? true,
    });
    setServiceModalOpen(true);
  };

  const handleSaveService = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.name.trim()) {
      onNotify(st("Enter a service name."));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        price: Number(formData.price) || 0,
        unit: formData.unit.trim() || 'Lượt',
        prep_time: Number(formData.prep_time) || 10,
        badge: formData.badge.trim() || null,
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        display_order: Number(formData.display_order) || 1,
        is_available: Boolean(formData.is_available),
      };

      if (editingService) {
        const updated = await updateRoomServiceCatalogItem(editingService.id, payload);
        setServices((prev) => prev.map((s) => (s.id === editingService.id ? { ...s, ...updated } : s)));
        onNotify(st("Service updated: {0}", payload.name));
      } else {
        const created = await createRoomServiceCatalogItem(payload);
        setServices((prev) => {
          // Tránh duplicate id nếu backend trả về item đã có
          const filtered = prev.filter((s) => s.id !== created.id);
          return [...filtered, created];
        });
        onNotify(st("Service added: {0}", payload.name));
      }
      setServiceModalOpen(false);
    } catch {
      onNotify(st("Unable to save the service."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (service) => {
    try {
      const updated = await toggleRoomServiceCatalogItem(service.id);
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, is_available: updated.is_available } : s))
      );
      onNotify(st("Service {0} updated: {1}", service.name, updated.is_available ? st('Available') : st('Paused')));
    } catch {
      onNotify(st("Unable to update service availability."));
    }
  };

  const handleDeleteService = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRoomServiceCatalogItem(deleteConfirm.id);
      setServices((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
      onNotify(st("Service deleted: {0}", deleteConfirm.name));
      setDeleteConfirm(null);
    } catch {
      onNotify(st("Unable to delete the service."));
    }
  };

  const formatCurrency = (amount) => {
    if (Number(amount) === 0) return st('Complimentary');
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  };

  return (
    <div className="staff-page-body flex-1 overflow-y-auto custom-scrollbar min-h-0 bg-[#FAF8F5] p-6 lg:p-8 space-y-6 pb-28 md:pb-12">
      {/* Top Header */}
      <StaffPageHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E2D9] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="staff-heading-decoration p-2.5 bg-[#4A3E3D] text-white rounded-xl shadow-sm">
              <ConciergeBell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#2C2420] tracking-tight">{st("Service Management")} </h1>
              <p className="text-sm text-[#7D716A]">{st("Manage room amenities, cleaning, spa and laundry services shown on the robot.")} </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadServices}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#DDD5CA] text-[#4A3E3D] rounded-xl hover:bg-[#F5EFEB] transition-all text-sm font-medium shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />{st("Refresh")} </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#4A3E3D] text-white rounded-xl hover:bg-[#382E2D] transition-all text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />{st("New service")} </button>
        </div>
      </StaffPageHeader>

      {/* KPI Cards & Toolbar */}
      <RoomServiceStatsAndFilters
        st={st}
        stats={stats}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categoryOptions={CATEGORY_OPTIONS}
        filteredCount={filteredServices.length}
        totalCount={services.length}
      />

      {/* Services Table */}
      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#7D716A] animate-spin" />
            <p className="text-sm text-[#7D716A]">{st("Loading service catalog...")}</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 bg-[#F5EFEB] text-[#7D716A] rounded-2xl flex items-center justify-center mx-auto">
              <ConciergeBell className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-[#2C2420]">{st("No services found")}</p>
            <p className="text-xs text-[#7D716A] max-w-sm mx-auto">{st("No services match your filters, or the catalog is empty.")} </p>
          </div>
        ) : (
          <>
          <RoomServiceCatalogTable
            st={st}
            paginatedServices={paginatedServices}
            formatCurrency={formatCurrency}
            handleToggleStatus={handleToggleStatus}
            handleOpenEditModal={handleOpenEditModal}
            setDeleteConfirm={setDeleteConfirm}
          />
          <Pagination
            currentPage={currentPage}
            totalItems={filteredServices.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemName={st('services')}
          />
          </>
        )}
      </div>

      {/* Modal: Thêm / Sửa Dịch Vụ */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E2D9] max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-[#E8E2D9]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#F5EFEB] text-[#4A3E3D] rounded-xl">
                  <ConciergeBell className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-[#2C2420]">
                  {editingService ? st("Edit room service") : st("Add room service")}
                </h2>
              </div>
              <button
                onClick={() => setServiceModalOpen(false)}
                className="p-1 text-[#7D716A] hover:text-[#2C2420] rounded-lg hover:bg-[#F5EFEB] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Service / amenity name")} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={st("e.g. Premium bath towel, Swedish full-body massage...")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Service category")} </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                  >
                    <option value="bath">{st("Room towels & amenities")}</option>
                    <option value="spa">{st("In-room massage & treatments")}</option>
                    <option value="bedding">{st("Extra pillows & blankets")}</option>
                    <option value="housekeeping">{st("Room cleaning & freshening")}</option>
                    <option value="laundry">{st("Laundry & garment care")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Unit")} </label>
                  <input
                    type="text"
                    placeholder={st("Item, set, 60-minute session, visit...")}
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Unit price (VND)")} <span className="text-xs text-[#7D716A]">{st("(0 = Complimentary)")}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.price}
                    onKeyDown={(e) => handleNumberInputBlockExponent(e)}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Preparation time (minutes)")} </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={formData.prep_time}
                    onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                    onChange={(e) => setFormData({ ...formData, prep_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Badge")} </label>
                  <input
                    type="text"
                    placeholder={st("Complimentary, Popular, Recommended, Premium...")}
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Display order")} </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.display_order}
                    onKeyDown={(e) => handleNumberInputBlockExponent(e, { allowDecimal: false })}
                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Image URL")} </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3E3D] mb-1">{st("Description")} </label>
                <textarea
                  rows="3"
                  placeholder={st("Describe the service, materials or preparation process...")}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420] resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modal_is_available"
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-[#4A3E3D] rounded border-[#DDD5CA] focus:ring-[#4A3E3D]"
                />
                <label htmlFor="modal_is_available" className="text-sm font-medium text-[#2C2420] select-none cursor-pointer">{st("Make this service available to guests")} </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E2D9]">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setServiceModalOpen(false)}
                  className="px-4 py-2 border border-[#DDD5CA] rounded-xl text-sm font-medium text-[#635750] hover:bg-[#F5EFEB] transition-all disabled:opacity-50"
                >{st("Cancel")} </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#4A3E3D] text-white rounded-xl text-sm font-semibold hover:bg-[#382E2D] transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {editingService ? (isSubmitting ? st("Saving...") : st("Save changes")) : (isSubmitting ? st("Adding...") : st("Add service"))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác Nhận Xóa */}
      <RoomServiceDeleteModal
        st={st}
        deleteConfirm={deleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteService}
      />
    </div>
  );
};

