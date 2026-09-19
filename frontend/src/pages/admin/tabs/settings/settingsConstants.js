import { Sliders, ShieldCheck, Bell, Network, Box } from 'lucide-react';

export const SETTINGS_STORAGE_KEY = 'aurora_admin_settings';

export const DEFAULT_SETTINGS = {
  // 1. General
  hotelName: 'Aurora Grand Hotel',
  address: '123 Main St, Cityville',
  systemTimezone: 'UTC+07:00 Asia/Ho_Chi_Minh',
  defaultLanguage: 'English (US)',
  voiceVolume: 75,
  nightMode: 'Quiet Navigation Only',

  // 2. Security & Access
  require2FA: true,
  idleTimeout: '30 Minutes',
  guestAuthForDeliveries: 'Room Number + PIN',
  allowRestrictedZones: false,
  autoLockScreen: true,

  // 3. Notifications
  primaryAlertEmail: 'admin@grandplaza.com',
  criticalHardwareErrors: true,
  lowBatteryWarning: true,
  connectivityLoss: false,
  activeChannels: {
    inAppConsole: true,
    smsAlerts: true,
    emailDigest: false,
    walkieTalkie: true,
  },
  escalationTimeout: 'Alert Manager after 5 minutes of no response',

  // 4. Integrations (PMS)
  pmsProvider: 'Oracle OPERA Cloud',
  pmsApiUrl: 'https://api.operacloud.com/v1/hotel/grandplaza',
  pmsAuthKey: 'ak_live_98f4a7c8192e0b65d14',
  pmsStatus: 'CONNECTED',
  smartElevatorApi: true,
  elevatorVendor: 'Schindler PORT Technology',
  automaticDoorControls: true,

  // 5. Advanced
  auditLogsRetention: '90 Days',
  anonymizeVoiceData: true,
  enableBetaNav: false,
};

export const SUB_TABS = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'security', label: 'Security & Access', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations (PMS)', icon: Network },
  { id: 'advanced', label: 'Advanced', icon: Box },
];
