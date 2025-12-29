
import React from 'react';
import { ChatSession, Language, Scheme, Application } from '../types';
import { translations } from '../translations';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  isDarkMode: boolean;
  language: Language;
  onLogout: () => void;
  bookmarks?: Scheme[];
  onOpenLocker: () => void;
  applications?: Application[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onDeleteSession,
  onNewChat, 
  isDarkMode, 
  language,
  onLogout,
  bookmarks = [],
  onOpenLocker,
  applications = []
}) => {
  const t = translations[language] || translations['en'];

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'Approved': return 'text-emerald-500';
      case 'Submitted': return 'text-blue-500';
      case 'Pending': return 'text-amber-500';
      case 'Rejected': return 'text-red-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 backdrop-blur-md transition-opacity duration-500 ${isOpen ? 'bg-black/40 opacity-100' : 'bg-transparent opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-50 w-[280px] md:w-[320px] transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform flex flex-col glass-panel backdrop-blur-3xl overflow-hidden border-r ${
          isOpen ? 'translate-x-0 shadow-[40px_0_80px_-20px_rgba(0,0,0,0.5)]' : '-translate-x-full shadow-none'
        } ${
          isDarkMode 
            ? 'bg-slate-950 border-white/[0.05]' 
            : 'bg-white border-slate-200 shadow-xl'
        } rounded-none`}
      >
        <div className="p-6 flex flex-col h-full relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className={`text-lg font-black tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className="w-1.5 h-5 bg-blue-600"></div>
              {t.history}
            </h2>
            <button 
              onClick={onClose}
              className={`w-9 h-9 flex items-center justify-center transition-all rounded-full border border-transparent active:scale-90 ${isDarkMode ? 'bg-white/5 hover:bg-white/10 hover:border-white/10 text-slate-400 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900'}`}
              title="Close History"
            >
              <i className="fas fa-times text-sm"></i>
            </button>
          </div>

          <button 
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-none transition-all active:scale-[0.98] mb-4 group border border-white/10"
          >
            <i className="fas fa-plus text-xs group-hover:rotate-90 transition-transform duration-300"></i>
            <span className="tracking-widest uppercase text-[10px]">{t.newChat}</span>
          </button>

          <button 
            onClick={() => {
              onOpenLocker();
              onClose();
            }}
            className={`w-full flex items-center justify-center space-x-3 font-black py-4 rounded-none transition-all active:scale-[0.98] mb-8 group border ${isDarkMode ? 'bg-white/5 hover:bg-white/10 border-white/5 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900'}`}
          >
            <i className="fas fa-vault text-xs group-hover:scale-110 transition-transform"></i>
            <span className="tracking-widest uppercase text-[10px]">{t.lockerTitle}</span>
          </button>

          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-10 custom-scrollbar">
            {/* 1. Chat & Enquiry History Section */}
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[2px] mb-4 px-4 ${isDarkMode ? 'text-slate-400 opacity-30' : 'text-slate-600 opacity-60'}`}>
                {t.recent}
              </p>
              {sessions.length === 0 ? (
                <div className="text-center py-10 opacity-10">
                  <i className="fas fa-comment-slash text-2xl mb-4"></i>
                  <p className="text-[10px] font-black uppercase tracking-[2px]">Empty History</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sessions.sort((a,b) => b.lastModified.getTime() - a.lastModified.getTime()).map((session) => (
                    <div key={session.id} className="group relative">
                      <button
                        onClick={() => {
                          onSelectSession(session.id);
                          onClose();
                        }}
                        className={`w-full text-left px-4 py-3 transition-all border flex items-center space-x-3 relative rounded-none mb-0.5 ${
                          activeSessionId === session.id 
                            ? isDarkMode 
                              ? 'bg-blue-600/10 border-blue-500/20 text-blue-300' 
                              : 'bg-blue-600/10 border-blue-600/20 text-blue-800'
                            : isDarkMode
                              ? 'bg-transparent border-transparent text-slate-400 hover:bg-white/5'
                              : 'bg-transparent border-transparent text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-1 h-3 transition-all duration-300 ${activeSessionId === session.id ? 'bg-blue-600' : 'bg-slate-500 opacity-20'}`}></div>
                        <span className={`flex-1 truncate font-bold text-xs tracking-tight ${!isDarkMode && activeSessionId !== session.id && 'text-slate-600'}`}>
                          {session.title || "Untitled Conversation"}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Delete this conversation?")) {
                            onDeleteSession(session.id);
                          }
                        }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full transition-all opacity-0 group-hover:opacity-100 ${
                          isDarkMode 
                            ? 'bg-white/5 hover:bg-red-500/20 text-red-400' 
                            : 'bg-slate-200 hover:bg-red-50 text-red-600'
                        }`}
                        title="Delete Session"
                      >
                        <i className="fas fa-times text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Application Tracker Section */}
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[2px] mb-4 px-4 flex items-center gap-2 ${isDarkMode ? 'text-emerald-400 opacity-60' : 'text-emerald-600 opacity-80'}`}>
                <i className="fas fa-map-location-dot text-[7px]"></i> {t.trackerTitle}
              </p>
              {applications.length === 0 ? (
                <div className="px-4 py-4 opacity-30 italic text-[10px] font-bold">
                  {t.trackerEmpty}
                </div>
              ) : (
                <div className="space-y-3 px-4">
                  {applications.map((app) => (
                    <div key={app.id} className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[11px] font-bold truncate leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{app.schemeName}</span>
                        <span className={`text-[8px] font-black uppercase tracking-wider ${getStatusColor(app.status)}`}>{app.status}</span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <div 
                          className={`h-full transition-all duration-1000 ${app.status === 'Approved' ? 'bg-emerald-500' : app.status === 'Rejected' ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${app.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-black opacity-30 uppercase">{app.progress}% {t.statusSubmitted}</span>
                        <span className="text-[8px] font-black opacity-30 uppercase">{app.lastUpdated}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Saved Schemes Section */}
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[2px] mb-4 px-4 flex items-center gap-2 ${isDarkMode ? 'text-blue-400 opacity-60' : 'text-blue-600 opacity-80'}`}>
                <i className="fas fa-bookmark text-[7px]"></i> {t.bookmarksTitle}
              </p>
              {bookmarks.length === 0 ? (
                <div className="px-4 py-4 opacity-30 italic text-[10px] font-bold">
                  {t.noBookmarks}
                </div>
              ) : (
                <div className="space-y-1">
                  {bookmarks.map((scheme) => (
                    <a
                      key={scheme.id}
                      href={scheme.link || '#'}
                      target={scheme.link ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      className={`w-full text-left px-4 py-3 transition-all border flex items-center space-x-3 group relative rounded-none mb-0.5 no-underline block ${
                        isDarkMode
                          ? 'bg-blue-500/5 border-blue-500/10 text-slate-300 hover:bg-blue-500/10'
                          : 'bg-blue-50/50 border-blue-100 text-slate-700 hover:bg-blue-50'
                      }`}
                    >
                      <div className="w-1 h-3 bg-blue-500"></div>
                      <div className="flex-1 truncate">
                        <div className="flex items-center justify-between">
                          <span className="block font-bold text-xs tracking-tight truncate">
                            {scheme.name}
                          </span>
                          {scheme.link && (
                            <i className="fas fa-external-link-alt text-[7px] opacity-0 group-hover:opacity-40 transition-opacity"></i>
                          )}
                        </div>
                        <span className="block text-[8px] uppercase tracking-wider opacity-50 font-black">
                          {scheme.category || 'Welfare'}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`mt-auto pt-6 border-t ${isDarkMode ? 'border-white/[0.05]' : 'border-slate-200'}`}>
            <button 
              onClick={onLogout}
              className={`w-full flex items-center justify-center space-x-3 mb-6 py-3 rounded-none transition-all ${isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-100'}`}
            >
              <i className="fas fa-sign-out-alt text-xs"></i>
              <span className="font-black uppercase text-[10px] tracking-widest">{t.logout}</span>
            </button>

            <div className="flex items-center space-x-3 px-1 group">
              <div className="w-8 h-8 bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                S
              </div>
              <div className="flex flex-col">
                <span className={`text-[10px] font-black tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.brand}<span className="text-blue-600">.AI</span></span>
                <span className={`text-[7px] font-black uppercase tracking-[2px] ${isDarkMode ? 'opacity-30' : 'text-slate-500 opacity-60'}`}>Core v2.5.1</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
