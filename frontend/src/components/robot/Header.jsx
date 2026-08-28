import React from 'react';

export const Header = ({ currentLanguage = 'English', onLanguageToggle }) => {
  return (
    <header className="w-full h-[84px] px-8 py-4 bg-aurora-inverse text-aurora-textInverse flex justify-between items-center overflow-hidden shrink-0">
      {/* Hotel Brand */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 bg-aurora-canvas rounded-full border-[1.5px] border-aurora-border flex items-center justify-center font-bold text-aurora-inverse text-lg shadow-sm">
          A
        </div>
        <div className="flex flex-col justify-center gap-0.5">
          <h1 className="text-lg font-semibold leading-6 tracking-wide text-aurora-textInverse">
            Aurora Grand Hotel
          </h1>
          <p className="text-xs font-normal leading-4 text-aurora-border">
            HCRobot • Lobby Concierge
          </p>
        </div>
      </div>

      {/* Language / Location Selector */}
      <button 
        onClick={onLanguageToggle}
        className="flex flex-col items-end gap-0.5 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
        aria-label="Change Language"
      >
        <span className="text-base font-semibold leading-5 text-aurora-textInverse">
          {currentLanguage}
        </span>
        <span className="text-xs font-normal leading-4 text-aurora-border">
          Tap to change language
        </span>
      </button>
    </header>
  );
};
