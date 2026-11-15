import React from 'react';
import {
  INITIAL_MENU_CATEGORIES,
  INITIAL_FOOD_ITEMS,
  formatCurrency,
} from './robotFoodMenuCatalog';
import { useRobotFoodMenuLogic } from './useRobotFoodMenuLogic';
import { RobotFoodMenuMainView } from './RobotFoodMenuMainView';
import { RobotFoodMenuModals } from './RobotFoodMenuModals';

export { INITIAL_MENU_CATEGORIES, INITIAL_FOOD_ITEMS, formatCurrency };

export const RobotFoodMenuScreen = ({
  activeRoomNumber = '',
  authenticatedRoom = null,
  onClose = () => {},
  onOrderSuccess = () => {},
  onRoomChange = () => {},
  onNotCheckedIn = () => {},
  onPinVerifiedSuccess = () => {},
  sessionId = null,
}) => {
  const {
    addToCart, cart, deleteFromCart, deliveryRoom, executePlaceOrder, handleCategoryClick, handleConfirmOrder, handleMainScroll, handleOpenRoomModal, isPinModalOpen, isPinModalSelectingRoom, isReviewModalOpen, isSubmitting, itemsByCategory, mainScrollRef, orderSuccessData, removeFromCart, searchQuery, selectedCategory, setDeliveryRoom, setIsLocalPinVerified, setIsPinModalOpen, setIsPinModalSelectingRoom, setIsReviewModalOpen, setOrderSuccessData, setSearchQuery, sidebarNavRef, totalItemsCount, totalPrice, totalVisibleItems,
  } = useRobotFoodMenuLogic({
    activeRoomNumber,
    authenticatedRoom,
    onOrderSuccess,
  });

  return (
    <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] bg-[#F5F2EB] text-[#1A1917] select-none flex overflow-hidden font-sans z-30 overscroll-none touch-none">
      <RobotFoodMenuMainView
        addToCart={addToCart}
        cart={cart}
        deliveryRoom={deliveryRoom}
        handleCategoryClick={handleCategoryClick}
        handleMainScroll={handleMainScroll}
        handleOpenRoomModal={handleOpenRoomModal}
        isReviewModalOpen={isReviewModalOpen}
        itemsByCategory={itemsByCategory}
        mainScrollRef={mainScrollRef}
        onClose={onClose}
        removeFromCart={removeFromCart}
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        setIsReviewModalOpen={setIsReviewModalOpen}
        setSearchQuery={setSearchQuery}
        sidebarNavRef={sidebarNavRef}
        totalItemsCount={totalItemsCount}
        totalPrice={totalPrice}
        totalVisibleItems={totalVisibleItems}
      />
      <RobotFoodMenuModals
        activeRoomNumber={activeRoomNumber}
        addToCart={addToCart}
        cart={cart}
        deleteFromCart={deleteFromCart}
        deliveryRoom={deliveryRoom}
        executePlaceOrder={executePlaceOrder}
        handleConfirmOrder={handleConfirmOrder}
        handleOpenRoomModal={handleOpenRoomModal}
        isPinModalOpen={isPinModalOpen}
        isPinModalSelectingRoom={isPinModalSelectingRoom}
        isReviewModalOpen={isReviewModalOpen}
        isSubmitting={isSubmitting}
        onClose={onClose}
        onNotCheckedIn={onNotCheckedIn}
        onPinVerifiedSuccess={onPinVerifiedSuccess}
        onRoomChange={onRoomChange}
        orderSuccessData={orderSuccessData}
        removeFromCart={removeFromCart}
        sessionId={sessionId}
        setDeliveryRoom={setDeliveryRoom}
        setIsLocalPinVerified={setIsLocalPinVerified}
        setIsPinModalOpen={setIsPinModalOpen}
        setIsPinModalSelectingRoom={setIsPinModalSelectingRoom}
        setIsReviewModalOpen={setIsReviewModalOpen}
        setOrderSuccessData={setOrderSuccessData}
        totalItemsCount={totalItemsCount}
        totalPrice={totalPrice}
      />
    </div>
  );
};

export default RobotFoodMenuScreen;
