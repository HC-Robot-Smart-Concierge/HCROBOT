import { useStaffText } from '../../context/StaffLanguage';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { Pagination } from '../../components/common/Pagination';
import { handleNumberInputBlockExponent } from '../../utils/numberInputHelper';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ConciergeBell,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Bath,
  HeartHandshake,
  BedDouble,
  Shirt,
  DollarSign,
  Image as ImageIcon,
  Tag,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import {
  fetchRoomServiceCatalog,
  createRoomServiceCatalogItem,
  updateRoomServiceCatalogItem,
  deleteRoomServiceCatalogItem,
  toggleRoomServiceCatalogItem,
} from '../../services/operationsApi';

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
          <p className="text-xs font-medium text-[#7D716A] uppercase tracking-wider">{st("Total services")}</p>
          <p className="text-3xl font-bold text-[#2C2420] mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">{st("Available services")}</p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">{stats.available}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">{st("Paused services")}</p>
          <p className="text-3xl font-bold text-amber-700 mt-1">{stats.paused}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E8E2D9] shadow-sm">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">{st("Complimentary services")}</p>
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
              placeholder={st("Search services or descriptions...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] text-[#2C2420]"
            />
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#7D716A] whitespace-nowrap">{st("Category:")}</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-[#F9F7F4] border border-[#DDD5CA] rounded-xl text-xs font-semibold text-[#2C2420] focus:outline-none focus:ring-2 focus:ring-[#4A3E3D] cursor-pointer shadow-sm"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-[#7D716A] whitespace-nowrap">{st("Showing")} <span className="font-semibold text-[#2C2420]">{filteredServices.length}</span> / {services.length} {st("services")} </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_OPTIONS.map((cat) => {
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E8E2D9] bg-[#FAF8F5] text-xs font-semibold text-[#7D716A] uppercase tracking-wider">
                  <th className="py-3.5 px-4">{st("Service & description")}</th>
                  <th className="py-3.5 px-4">{st("Category")}</th>
                  <th className="py-3.5 px-4">{st("Price & unit")}</th>
                  <th className="py-3.5 px-4">{st("Service time")}</th>
                  <th className="py-3.5 px-4 text-center">{st("Status")}</th>
                  <th className="py-3.5 px-4 text-right">{st("Actions")}</th>
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
                          <span className="text-[10px] font-mono text-[#A89F97] mt-0.5 block">{st("ID:")} {service.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5EFEB] text-xs font-medium text-[#4A3E3D]">
                        {service.category === 'bath' && st("Towels & amenities")}
                        {service.category === 'spa' && st("In-room massage")}
                        {service.category === 'bedding' && st("Pillows & blankets")}
                        {service.category === 'housekeeping' && st("Room cleaning")}
                        {service.category === 'laundry' && st("Laundry")}
                        {!['bath', 'spa', 'bedding', 'housekeeping', 'laundry'].includes(service.category) && service.category}
                      </span>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-[#2C2420]">
                        {formatCurrency(service.price)}
                      </div>
                      <div className="text-xs text-[#7D716A]">{service.unit}</div>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-[#635750]">
                        <Clock className="w-3.5 h-3.5 text-[#7D716A]" />
                        <span>{service.prep_time} {st("min")}</span>
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
                        title={st("Toggle service availability")}
                      >
                        {service.is_available ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />{st("Available")} </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />{st("Paused")} </>
                        )}
                      </button>
                    </td>

                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(service)}
                          className="p-1.5 rounded-lg text-[#635750] hover:text-[#2C2420] hover:bg-[#F5EFEB] transition-all"
                          title={st("Edit service")}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(service)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-all"
                          title={st("Delete service")}
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
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E8E2D9] max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-[#2C2420]">{st("Delete room service")}</h3>
              <p className="text-sm text-[#7D716A]">{st("Are you sure you want to delete")}{' '}
                <span className="font-semibold text-[#2C2420]">"{deleteConfirm.name}"</span>{st("? This service will no longer appear on the robot or guest app.")} </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-[#DDD5CA] rounded-xl text-sm font-medium text-[#635750] hover:bg-[#F5EFEB] transition-all"
              >{st("Cancel")} </button>
              <button
                onClick={handleDeleteService}
                className="px-5 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition-all shadow-sm"
              >{st("Confirm deletion")} </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

