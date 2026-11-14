import React from 'react';
import { Globe } from 'lucide-react';
import { StaffPageHeader } from '../../components/dashboard/RoomServiceFrame';
import { useLanguage } from '../../context/LanguageContext';
import { useStaffText } from '../../context/StaffLanguage';

export function StaffSettingsPage({ portal = 'room_service' }) {
  const { language, setLanguage, t } = useLanguage();
  const st = useStaffText();
  const description = {
    room_service: 'Display preferences for the Room Service portal.',
    reception: 'Display preferences for the Reception portal.',
    maintenance: 'Display preferences for the Maintenance portal.',
    bell_services: 'Display preferences for the Bell Services portal.',
    kitchen: 'Display preferences for the Kitchen portal.',
    concierge: 'Display preferences for the Concierge portal.',
  }[portal] || 'Display preferences for the Room Service portal.';
  return (
    <div className="staff-page-body flex-1 overflow-y-auto p-4">
      <StaffPageHeader className="mb-6">
        <div><h1>{t('adminSettings')}</h1><p>{st(description)}</p></div>
      </StaffPageHeader>
      <section className="room-service-settings-card">
        <h2 className="text-sm font-bold flex items-center gap-2"><Globe size={16} />{t('settingsSystemLang')}</h2>
        <p className="text-xs text-stone-500 mt-2">{t('settingsSystemLangDesc')}</p>
        <div className="room-service-language-options" role="group" aria-label={t('settingsInterfaceLang')}>
          {[['EN', 'English'], ['VI', 'Tiếng Việt']].map(([code, label]) => (
            <button key={code} type="button" lang={code.toLowerCase()} aria-pressed={language === code} onClick={() => setLanguage(code)}>
              <strong>{label}</strong>
              <small>{language === code ? t('settingsLangActive') : code}</small>
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500 mt-4">{t('settingsLangNotice')}</p>
      </section>
    </div>
  );
}
