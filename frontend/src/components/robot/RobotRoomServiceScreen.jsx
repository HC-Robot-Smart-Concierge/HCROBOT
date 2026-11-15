import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createRoomServiceOrder, fetchRoomOrdersHistory, fetchRoomServiceCatalog } from '../../services/operationsApi';
import {
  ROOM_SERVICE_CATALOG,
  SERVICE_CATEGORIES,
} from './robotRoomServiceCatalog';
import { RobotRoomServiceMainView } from './RobotRoomServiceMainView';
import { RobotRoomServiceReviewAndPinModals } from './RobotRoomServiceReviewAndPinModals';
import { RobotRoomServiceSuccessAndStatusModals } from './RobotRoomServiceSuccessAndStatusModals';

export { ROOM_SERVICE_CATALOG, SERVICE_CATEGORIES };

export const RobotRoomServiceScreen = ({
  activeRoomNumber = '',
  authenticatedRoom = null,
  onClose,
  onRoomChange,
  onRequestSuccess,
  onNotCheckedIn,
  onPinVerifiedSuccess = () => {},
  sessionId = null,
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [catalogItems, setCatalogItems] = useState(() =>
    ROOM_SERVICE_CATALOG.filter(
      (it) => !it.name?.toLowerCase().includes('nước khoáng') && !it.name?.toLowerCase().includes('nuoc khoang')
    )
  );
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      try {
        const items = await fetchRoomServiceCatalog({ is_available: true });
        if (isMounted && Array.isArray(items) && items.length > 0) {
          const cleaned = items.filter(
            (it) => !it.name?.toLowerCase().includes('nước khoáng') && !it.name?.toLowerCase().includes('nuoc khoang')
          );
          setCatalogItems(cleaned);
        }
      } catch (err) {
        console.warn('[RobotRoomServiceScreen] Failed to load catalog from server, using fallback', err);
      }
    };
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);
  const [cart, setCart] = useState({});
  const [requestNote, setRequestNote] = useState('');
  const [targetRoom, setTargetRoom] = useState(activeRoomNumber || '');
  useEffect(() => {
    if (activeRoomNumber && String(activeRoomNumber).trim()) {
      setTargetRoom(String(activeRoomNumber).trim());
    }
  }, [activeRoomNumber]);
  const [isLocalPinVerified, setIsLocalPinVerified] = useState(false);
  const isRoomAuth = Boolean(
    (authenticatedRoom && targetRoom && String(authenticatedRoom).trim() === String(targetRoom).trim()) ||
    (isLocalPinVerified && targetRoom)
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinModalSelectingRoom, setIsPinModalSelectingRoom] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusOrders, setStatusOrders] = useState([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const loadStatusForRoom = useCallback(async (roomNum) => {
    const room = roomNum || targetRoom;
    if (!room || !String(room).trim()) {
      setIsPinModalSelectingRoom(true);
      setIsPinModalOpen(true);
      return;
    }
    setIsLoadingStatus(true);
    setIsStatusModalOpen(true);
    try {
      const res = await fetchRoomOrdersHistory(room);
      setStatusOrders(res?.orders || []);
    } catch {
      setStatusOrders([]);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [targetRoom]);
  // Real-time WebSocket listener for order status tracking modal
  useEffect(() => {
    const handleLiveStatus = () => {
      if (isStatusModalOpen) {
        loadStatusForRoom();
      }
    };
    window.addEventListener('app:task_status_updated', handleLiveStatus);
    return () => {
      window.removeEventListener('app:task_status_updated', handleLiveStatus);
    };
  }, [isStatusModalOpen, loadStatusForRoom]);
  const filteredServices = useMemo(() => {
    const list = catalogItems.length > 0 ? catalogItems : ROOM_SERVICE_CATALOG;
    if (activeCategory === 'all') return list;
    return list.filter((item) => item.category === activeCategory);
  }, [catalogItems, activeCategory]);
  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
  }, [cart]);
  const totalPrice = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.item.price * entry.qty, 0);
  }, [cart]);
  const handleAddToCart = (item) => {
    setCart((prev) => {
      const currentQty = prev[item.id]?.qty || 0;
      return {
        ...prev,
        [item.id]: { item, qty: currentQty + 1 },
      };
    });
  };
  const handleRemoveFromCart = (itemId) => {
    setCart((prev) => {
      const currentQty = prev[itemId]?.qty || 0;
      if (currentQty <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return {
        ...prev,
        [itemId]: { ...prev[itemId], qty: currentQty - 1 },
      };
    });
  };

  const executeSubmitRequest = async (verifiedRoom, guestNameOverride) => {
    setIsSubmitting(true);
    const roomToUse = verifiedRoom || targetRoom;
    const itemsPayload = Object.values(cart).map((entry) => ({
      name: entry.item.name,
      qty: entry.qty,
      price: entry.item.price,
      notes: entry.item.unit || '',
    }));
    const itemsSummary = Object.values(cart).map((c) => `${c.qty}x ${c.item.name}`).join(', ');
    try {
      const res = await createRoomServiceOrder({
        room_number: roomToUse,
        guest_name: guestNameOverride || undefined,
        special_instructions: requestNote
          ? `[Dịch vụ phòng Room Service] ${requestNote}`
          : `[Dịch vụ phòng Room Service] Yêu cầu ${itemsSummary}`,
        items: itemsPayload,
        total_amount: totalPrice,
        note: requestNote || `Yêu cầu dịch vụ phòng: ${itemsSummary}`,
        is_service_request: true,
      });
      const isMerged = Boolean(res?.is_merged);
      const orderCode = res?.ticket_code || res?.order_number || res?.id || `RS-${Math.floor(1000 + Math.random() * 9000)}`;
      setSuccessData({
        orderCode,
        room: roomToUse,
        totalAmount: res?.total_amount || totalPrice,
        itemCount: totalItemsCount,
        itemsSummary,
        isMerged,
      });
      setCart({});
      setRequestNote('');
      setIsReviewModalOpen(false);
      setIsLocalPinVerified(true);
      if (typeof onPinVerifiedSuccess === 'function') {
        onPinVerifiedSuccess(roomToUse);
      }
      if (onRequestSuccess) {
        onRequestSuccess({
          ...res,
          orderCode,
          room_number: roomToUse,
          totalAmount: totalPrice,
          itemsSummary,
        });
      }
    } catch {
      const fallbackCode = `RS-${Math.floor(1000 + Math.random() * 9000)}`;
      setSuccessData({
        orderCode: fallbackCode,
        room: roomToUse,
        totalAmount: totalPrice,
        itemCount: totalItemsCount,
        itemsSummary,
      });
      setCart({});
      setIsReviewModalOpen(false);
      setIsLocalPinVerified(true);
      if (typeof onPinVerifiedSuccess === 'function') {
        onPinVerifiedSuccess(roomToUse);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-30 overscroll-none touch-none">
      <RobotRoomServiceMainView
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        onClose={onClose}
        targetRoom={targetRoom}
        setIsPinModalSelectingRoom={setIsPinModalSelectingRoom}
        setIsPinModalOpen={setIsPinModalOpen}
        loadStatusForRoom={loadStatusForRoom}
        totalItemsCount={totalItemsCount}
        setIsReviewModalOpen={setIsReviewModalOpen}
        filteredServices={filteredServices}
        cart={cart}
        handleAddToCart={handleAddToCart}
        handleRemoveFromCart={handleRemoveFromCart}
        totalPrice={totalPrice}
      />

      <RobotRoomServiceReviewAndPinModals
        isReviewModalOpen={isReviewModalOpen}
        setIsReviewModalOpen={setIsReviewModalOpen}
        targetRoom={targetRoom}
        setTargetRoom={setTargetRoom}
        activeRoomNumber={activeRoomNumber}
        authenticatedRoom={authenticatedRoom}
        isLocalPinVerified={isLocalPinVerified}
        setIsLocalPinVerified={setIsLocalPinVerified}
        isPinModalOpen={isPinModalOpen}
        setIsPinModalOpen={setIsPinModalOpen}
        isPinModalSelectingRoom={isPinModalSelectingRoom}
        setIsPinModalSelectingRoom={setIsPinModalSelectingRoom}
        isStatusModalOpen={isStatusModalOpen}
        loadStatusForRoom={loadStatusForRoom}
        cart={cart}
        requestNote={requestNote}
        setRequestNote={setRequestNote}
        totalItemsCount={totalItemsCount}
        totalPrice={totalPrice}
        isSubmitting={isSubmitting}
        executeSubmitRequest={executeSubmitRequest}
        onPinVerifiedSuccess={onPinVerifiedSuccess}
        sessionId={sessionId}
        onRoomChange={onRoomChange}
        onClose={onClose}
      />

      <RobotRoomServiceSuccessAndStatusModals
        successData={successData}
        setSuccessData={setSuccessData}
        onClose={onClose}
        isStatusModalOpen={isStatusModalOpen}
        setIsStatusModalOpen={setIsStatusModalOpen}
        targetRoom={targetRoom}
        setIsPinModalSelectingRoom={setIsPinModalSelectingRoom}
        setIsPinModalOpen={setIsPinModalOpen}
        isLoadingStatus={isLoadingStatus}
        loadStatusForRoom={loadStatusForRoom}
        statusOrders={statusOrders}
      />
    </div>
  );
};
