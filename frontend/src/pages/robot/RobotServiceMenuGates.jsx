import React from 'react';
import { RobotFoodMenuScreen } from '../../components/robot/RobotFoodMenuScreen';
import { RobotRoomServiceScreen } from '../../components/robot/RobotRoomServiceScreen';
import { RobotMaintenanceMenuScreen } from '../../components/robot/RobotMaintenanceMenuScreen';
import { RobotBellmanMenuScreen, bellRequestMessage } from '../../components/robot/RobotBellmanMenuScreen';

/**
 * Fullscreen early-return service menu gates (Food, Maintenance, Bellman, Room Service).
 */
export const RobotServiceMenuGates = ({
  language, sessionId, activeRoomNumber, setActiveRoomNumber, authenticatedRoom, setAuthenticatedRoom, isFoodMenuOpen, setIsFoodMenuOpen, isMaintenanceMenuOpen, setIsMaintenanceMenuOpen, isBellmanMenuOpen, setIsBellmanMenuOpen, isRoomServiceMenuOpen, setIsRoomServiceMenuOpen, isWaitingRoomForStatusQueryRef, isRoomPickerOpenRef, setIsRoomPickerOpen, triggerFollowUpPrompt, handlePinNotCheckedIn,
}) => {
  if (isFoodMenuOpen) {
    return (
      <RobotFoodMenuScreen
        activeRoomNumber={activeRoomNumber || ''}
        authenticatedRoom={authenticatedRoom}
        onPinVerifiedSuccess={(room) => setAuthenticatedRoom(room)}
        sessionId={sessionId}
        onClose={() => {
          setIsFoodMenuOpen(false);
          setIsRoomServiceMenuOpen(false);
        }}
        onRoomChange={(room) => {
          setActiveRoomNumber(room);
          if (authenticatedRoom && String(authenticatedRoom).trim() !== String(room).trim()) {
            setAuthenticatedRoom(null);
          }
        }}
        onOrderSuccess={(order) => {
          setIsFoodMenuOpen(false);
          isWaitingRoomForStatusQueryRef.current = false;
          isRoomPickerOpenRef.current = false;
          setIsRoomPickerOpen(false);
          setIsRoomServiceMenuOpen(false);
          const roomToMention = order?.room_number || activeRoomNumber;
          if (roomToMention) {
            setActiveRoomNumber(roomToMention);
            setAuthenticatedRoom(roomToMention);
          }
          const isEn = language === 'English';
          const msg = isEn
            ? `Your food order for room ${roomToMention ? roomToMention : 'your room'} has been sent to the kitchen successfully! Do you need any further assistance?`
            : `Dạ đơn đặt món cho phòng ${roomToMention ? roomToMention : 'của quý khách'} đã được gửi tới nhà bếp thành công rồi ạ! Quý khách có cần Rora hỗ trợ thêm gì nữa không ạ?`;
          triggerFollowUpPrompt(msg, isEn);
        }}
        onNotCheckedIn={handlePinNotCheckedIn}
      />
    );
  }

  if (isMaintenanceMenuOpen) {
    return (
      <RobotMaintenanceMenuScreen
        language={language}
        activeRoomNumber={activeRoomNumber || ''}
        authenticatedRoom={authenticatedRoom}
        onPinVerifiedSuccess={(room) => {
          setAuthenticatedRoom(room);
          setActiveRoomNumber(room);
        }}
        onRoomChange={(room) => {
          setActiveRoomNumber(room);
          if (authenticatedRoom && String(authenticatedRoom).trim() !== String(room).trim()) {
            setAuthenticatedRoom(null);
          }
        }}
        onClose={() => setIsMaintenanceMenuOpen(false)}
        onRequestSuccess={(req) => {
          setIsMaintenanceMenuOpen(false);
          setIsBellmanMenuOpen(false);
          isWaitingRoomForStatusQueryRef.current = false;
          isRoomPickerOpenRef.current = false;
          setIsRoomPickerOpen(false);
          const roomToMention = req?.room_number || req?.location || activeRoomNumber;
          if (roomToMention) {
            setActiveRoomNumber(roomToMention);
            setAuthenticatedRoom(roomToMention);
          }
          const isEn = language === 'English';
          const msg = isEn
            ? `Your maintenance request for Room ${roomToMention ? roomToMention : 'your room'} has been sent to our Technical Team. Do you need any further assistance?`
            : `Dạ yêu cầu bảo trì cho Phòng ${roomToMention ? roomToMention : 'của quý khách'} đã được chuyển đến bộ phận Kỹ thuật rồi ạ. Quý khách có cần Rora hỗ trợ thêm gì nữa không ạ?`;
          triggerFollowUpPrompt(msg, isEn);
        }}
        onNotCheckedIn={handlePinNotCheckedIn}
      />
    );
  }

  if (isBellmanMenuOpen) {
    return (
      <RobotBellmanMenuScreen
        language={language}
        activeRoomNumber={activeRoomNumber || ''}
        authenticatedRoom={authenticatedRoom}
        onPinVerifiedSuccess={(room) => {
          setAuthenticatedRoom(room);
          setActiveRoomNumber(room);
        }}
        onRoomChange={(room) => {
          setActiveRoomNumber(room);
          if (authenticatedRoom && String(authenticatedRoom).trim() !== String(room).trim()) {
            setAuthenticatedRoom(null);
          }
        }}
        onClose={() => setIsBellmanMenuOpen(false)}
        onRequestSuccess={(req) => {
          setIsBellmanMenuOpen(false);
          isWaitingRoomForStatusQueryRef.current = false;
          isRoomPickerOpenRef.current = false;
          setIsRoomPickerOpen(false);
          const roomToMention = req?.room_number || req?.location || activeRoomNumber;
          if (roomToMention) {
            setActiveRoomNumber(roomToMention);
            setAuthenticatedRoom(roomToMention);
          }
          const isEn = language === 'English';
          const followUp = isEn ? ' Do you need any further assistance?' : ' Quý khách có cần Rora hỗ trợ thêm gì nữa không ạ?';
          triggerFollowUpPrompt(`${bellRequestMessage(req, isEn)}${followUp}`, isEn);
        }}
        onNotCheckedIn={handlePinNotCheckedIn}
      />
    );
  }

  if (isRoomServiceMenuOpen) {
    return (
      <RobotRoomServiceScreen
        activeRoomNumber={activeRoomNumber || ''}
        authenticatedRoom={authenticatedRoom}
        onPinVerifiedSuccess={(room) => setAuthenticatedRoom(room)}
        sessionId={sessionId}
        onClose={() => {
          setIsRoomServiceMenuOpen(false);
          setIsFoodMenuOpen(false);
        }}
        onRoomChange={(room) => {
          setActiveRoomNumber(room);
          if (authenticatedRoom && String(authenticatedRoom).trim() !== String(room).trim()) {
            setAuthenticatedRoom(null);
          }
        }}
        onRequestSuccess={(req) => {
          isWaitingRoomForStatusQueryRef.current = false;
          isRoomPickerOpenRef.current = false;
          setIsRoomPickerOpen(false);
          setIsRoomServiceMenuOpen(false);
          setIsFoodMenuOpen(false);
          const roomToMention = req?.room_number || activeRoomNumber;
          if (roomToMention) {
            setActiveRoomNumber(roomToMention);
            setAuthenticatedRoom(roomToMention);
          }
          const isEn = language === 'English';
          const msg = isEn
            ? `Your room service request for room ${roomToMention ? roomToMention : 'your room'} has been sent to Room Service successfully! Do you need any further assistance?`
            : `Dạ yêu cầu dịch vụ phòng cho phòng ${roomToMention ? roomToMention : 'của quý khách'} đã được gửi tới bộ phận phục vụ phòng Room Service rồi ạ! Quý khách có cần Rora hỗ trợ thêm gì nữa không ạ?`;
          triggerFollowUpPrompt(msg, isEn);
        }}
        onNotCheckedIn={handlePinNotCheckedIn}
      />
    );
  }

  return null;
};
