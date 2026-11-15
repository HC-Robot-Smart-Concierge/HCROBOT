import { useState, useMemo, useEffect, useRef } from 'react';
import { createRoomServiceOrder } from '../../services/operationsApi';
import { INITIAL_MENU_CATEGORIES, INITIAL_FOOD_ITEMS } from './robotFoodMenuCatalog';

export function useRobotFoodMenuLogic({
  activeRoomNumber,
  authenticatedRoom,
  onOrderSuccess,
}) {
  const [selectedCategory, setSelectedCategory] = useState(INITIAL_MENU_CATEGORIES[0]?.id || 'appetizers');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState({}); // { [itemId]: { item, qty } }
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [deliveryRoom, setDeliveryRoom] = useState(() => {
    if (activeRoomNumber && String(activeRoomNumber).trim()) {
      return String(activeRoomNumber).trim();
    }
    return '';
  });

  useEffect(() => {
    if (activeRoomNumber && String(activeRoomNumber).trim()) {
      setDeliveryRoom(String(activeRoomNumber).trim());
    }
  }, [activeRoomNumber]);
  const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);
  const isRoomAuth = Boolean(
    (authenticatedRoom && deliveryRoom && String(authenticatedRoom).trim() === String(deliveryRoom).trim()) ||
    (isLocalPinVerified && deliveryRoom)
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinModalSelectingRoom, setIsPinModalSelectingRoom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState(null);

  const handleOpenRoomModal = () => {
    setIsPinModalSelectingRoom(true);
    setIsPinModalOpen(true);
  };

  const mainScrollRef = useRef(null);
  const sidebarNavRef = useRef(null);
  const isManualScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Khóa overscroll toàn màn hình để không bị kéo dãn lộ khoảng trắng trên PWA/mobile
  useEffect(() => {
    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Khi mở drawer "Xem lại menu", khóa tuyệt đối không cho chạm/cuộn xuyên màn hình menu bên dưới
  useEffect(() => {
    if (!isReviewModalOpen) return;

    const handleTouchMove = (e) => {
      // Chỉ cho phép cuộn ngón tay nếu chạm bên trong danh sách món của giỏ hàng
      const isInsideCartList = e.target.closest('.cart-drawer-scrollable');
      if (!isInsideCartList) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isReviewModalOpen]);

  // Gom nhóm tất cả món ăn theo danh mục & áp dụng lọc tìm kiếm
  const itemsByCategory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return INITIAL_MENU_CATEGORIES.map((cat) => {
      const items = INITIAL_FOOD_ITEMS.filter((item) => {
        const matchCategory = item.category === cat.id;
        const matchSearch =
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query);
        return matchCategory && matchSearch;
      });
      return {
        category: cat,
        items,
      };
    });
  }, [searchQuery]);

  const totalVisibleItems = useMemo(() => {
    return itemsByCategory.reduce((sum, group) => sum + group.items.length, 0);
  }, [itemsByCategory]);

  // Điều hướng cuộn mượt đến danh mục món ăn khi nhấn ở thanh bên trái
  const handleCategoryClick = (catId) => {
    setSelectedCategory(catId);
    isManualScrollingRef.current = true;

    const container = mainScrollRef.current;
    const targetEl = document.getElementById(`cat-section-${catId}`);
    if (container && targetEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const targetScrollTop = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({
        top: Math.max(0, targetScrollTop - 4),
        behavior: 'smooth',
      });
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 700);
  };

  // Tự động nhận diện danh mục đang xem khi lướt danh sách món (Scroll-Spy)
  const handleMainScroll = () => {
    if (isManualScrollingRef.current) return;
    const container = mainScrollRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 30;

    if (isAtBottom) {
      const activeGroups = itemsByCategory.filter((g) => g.items.length > 0);
      const lastGroup = activeGroups[activeGroups.length - 1];
      if (lastGroup && lastGroup.category.id !== selectedCategory) {
        setSelectedCategory(lastGroup.category.id);
        const sidebarBtn = document.getElementById(`sidebar-cat-${lastGroup.category.id}`);
        if (sidebarBtn) {
          sidebarBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      return;
    }

    let activeCatId = null;
    for (const group of itemsByCategory) {
      if (group.items.length === 0) continue;
      const el = document.getElementById(`cat-section-${group.category.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerRect.top <= 100) {
          activeCatId = group.category.id;
        }
      }
    }

    if (activeCatId && activeCatId !== selectedCategory) {
      setSelectedCategory(activeCatId);
      const sidebarBtn = document.getElementById(`sidebar-cat-${activeCatId}`);
      if (sidebarBtn) {
        sidebarBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Cart totals
  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
  }, [cart]);

  const addToCart = (item) => {
    setCart((prev) => {
      const currentQty = prev[item.id]?.qty || 0;
      return {
        ...prev,
        [item.id]: {
          item,
          qty: currentQty + 1,
        },
      };
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const currentQty = prev[itemId]?.qty || 0;
      if (currentQty <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          qty: currentQty - 1,
        },
      };
    });
  };

  const deleteFromCart = (itemId) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const executePlaceOrder = async (targetRoom, guestNameOverride) => {
    setIsSubmitting(true);
    const roomToUse = targetRoom || deliveryRoom;
    const orderItemsPayload = Object.values(cart).map((entry) => ({
      name: entry.item.name,
      qty: entry.qty,
      price: entry.item.price,
      notes: entry.item.portion || '',
    }));

    try {
      const res = await createRoomServiceOrder({
        room_number: roomToUse,
        guest_name: guestNameOverride || undefined,
        special_instructions: orderNote || 'Đặt món qua màn hình Robot AI (Đã xác thực PIN)',
        items: orderItemsPayload,
        total_amount: totalPrice,
      });

      const isMerged = Boolean(res?.is_merged);
      setOrderSuccessData({
        orderCode: res?.ticket_code || res?.order_number || res?.id || `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        room: roomToUse,
        totalAmount: res?.total_amount || totalPrice,
        itemCount: totalItemsCount,
        isMerged,
      });

      setCart({});
      setOrderNote('');
      setDeliveryRoom(roomToUse);
      onRoomChange(roomToUse);
      setIsLocalPinVerified(true);
      if (typeof onPinVerifiedSuccess === 'function') {
        onPinVerifiedSuccess(roomToUse);
      }
      try { localStorage.removeItem('robot_delivery_room'); } catch {}
      setIsReviewModalOpen(false);
      onOrderSuccess(res);
    } catch {
      setOrderSuccessData({
        orderCode: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        room: roomToUse,
        totalAmount: totalPrice,
        itemCount: totalItemsCount,
      });
      setCart({});
      setIsReviewModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOrder = () => {
    if (totalItemsCount === 0 || isSubmitting) return;
    const roomToUse = deliveryRoom || activeRoomNumber;
    const isCurrentlyAuth = Boolean(
      roomToUse &&
      ((authenticatedRoom && String(authenticatedRoom).trim() === String(roomToUse).trim()) ||
       isLocalPinVerified)
    );
    if (isCurrentlyAuth && roomToUse && String(roomToUse).trim()) {
      // Đã xác thực PIN trong session -> Đặt món ngay, không hỏi lại mã PIN
      setIsReviewModalOpen(false);
      executePlaceOrder(roomToUse);
    } else {
      // Chưa xác thực mã PIN phòng trong session -> Mở modal PIN
      setIsReviewModalOpen(false);
      if (roomToUse && String(roomToUse).trim()) {
        // Đã có số phòng (VD: 301) -> mở thẳng bàn phím nhập PIN cho phòng đó
        setIsPinModalSelectingRoom(false);
      } else {
        // Chưa có số phòng -> mở chọn số phòng trước
        setIsPinModalSelectingRoom(true);
      }
      setIsPinModalOpen(true);
    }
  };

  return {
    selectedCategory,
    searchQuery,
    setSearchQuery,
    cart,
    isReviewModalOpen,
    setIsReviewModalOpen,
    orderNote,
    setOrderNote,
    deliveryRoom,
    setDeliveryRoom,
    setIsLocalPinVerified,
    isPinModalOpen,
    setIsPinModalOpen,
    isPinModalSelectingRoom,
    setIsPinModalSelectingRoom,
    isSubmitting,
    orderSuccessData,
    setOrderSuccessData,
    handleOpenRoomModal,
    sidebarNavRef,
    mainScrollRef,
    itemsByCategory,
    totalItemsCount,
    totalPrice,
    totalVisibleItems,
    handleCategoryClick,
    handleMainScroll,
    addToCart,
    removeFromCart,
    deleteFromCart,
    executePlaceOrder,
    handleConfirmOrder,
  };
}
