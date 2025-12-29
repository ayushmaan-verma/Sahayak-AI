
import React from 'react';
import { UserProfile, Language } from '../types';
import { translations } from '../translations';

interface HeaderProps {
  profile: UserProfile | null;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onRestart: () => void;
  onGoHome: () => void;
  onToggleTheme: () => void;
  onOpenMenu: () => void;
  isDarkMode: boolean;
  isSyncing?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  profile, 
  language, 
  onLanguageChange, 
  onEditProfile, 
  onGoHome, 
  onToggleTheme, 
  onOpenMenu,
  isDarkMode,
  isSyncing = false
}) => {
  const t = translations[language];

  return (
    <header className="px-2 py-2 md:px-5 md:py-4 flex-shrink-0">
      <div className={`max-w-7xl mx-auto glass-panel rounded-full px-3 py-1.5 md:px-6 md:py-3 flex items-center justify-between shadow-xl border transition-all ${isDarkMode ? 'bg-slate-900/60 border-white/5 shadow-black/40' : 'bg-white/70 border-white/60 shadow-slate-200/40'}`}>
        
        {/* Left Side - Menu & Sync Status */}
        <div className="flex-1 flex items-center justify-start space-x-3">
          <button 
            onClick={onOpenMenu}
            className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${isDarkMode ? 'bg-slate-800 text-white border-white/10' : 'bg-blue-600 text-white shadow-blue-500/20'}`}
          >
            <i className="fas fa-bars text-xs md:text-sm"></i>
          </button>
          
          <div className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <i className={`fas fa-cloud ${isSyncing ? 'animate-pulse text-blue-500' : 'text-emerald-500'} text-[10px]`}></i>
            <span className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {isSyncing ? 'Syncing...' : 'Synced'}
            </span>
          </div>
        </div>

        {/* Center - Logo */}
        <div className="flex-none px-2">
          <button onClick={onGoHome} className="active:scale-95 transition-transform flex items-center space-x-2">
            <h1 className={`text-lg md:text-2xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t.brand}<span className="text-blue-600">.AI</span>
            </h1>
          </button>
        </div>

        {/* Right Side - Actions */}
        <div className="flex-1 flex items-center justify-end space-x-1.5 md:space-x-4">
          <div className="relative group">
            <select 
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className={`appearance-none bg-transparent outline-none font-black text-[9px] md:text-[10px] uppercase tracking-widest pl-3 pr-6 py-1.5 md:pl-5 md:pr-9 md:py-2.5 rounded-full border transition-all cursor-pointer shadow-sm ${ isDarkMode ? 'bg-slate-800 border-white/10 text-slate-300 hover:border-white/20' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300' }`}
            >
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="bn">BN</option>
              <option value="mr">MR</option>
              <option value="ta">TA</option>
              <option value="te">TE</option>
              <option value="pa">PA</option>
            </select>
            <i className="fas fa-language absolute right-2.5 md:right-4 top-1/2 -translate-y-1/2 text-[8px] md:text-xs opacity-50 pointer-events-none"></i>
          </div>

          <button onClick={onToggleTheme} className={`w-8 h-8 md:w-11 md:h-11 flex items-center justify-center rounded-full border shadow-sm transition-all active:scale-90 ${isDarkMode ? 'bg-slate-800 border-white/10 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}>
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-[10px] md:text-xs`}></i>
          </button>

          {profile && (
            <button 
              onClick={onEditProfile}
              className={`w-8 h-8 md:w-11 md:h-11 flex items-center justify-center rounded-full border shadow-sm transition-all active:scale-90 ${isDarkMode ? 'bg-slate-800 border-white/10 text-blue-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-blue-600 hover:bg-slate-50'}`}
              title={t.updateProfile}
            >
              <i className="fas fa-user-circle text-xs md:text-base"></i>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
