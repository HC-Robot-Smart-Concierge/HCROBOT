import { useEffect, useState } from 'react';

const isRunningStandalone = () => (
  window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true
);

export const usePwaInstall = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(isRunningStandalone);
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    return choice?.outcome === 'accepted';
  };

  return {
    canInstall: Boolean(installPrompt),
    isIos,
    isStandalone,
    promptInstall,
  };
};
