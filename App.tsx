
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ProfileForm from './components/ProfileForm';
import ChatInterface from './components/ChatInterface';
import AuthScreen from './components/AuthScreen';
import Toast, { ToastType } from './components/Toast';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, syncProfile, syncUserData, syncSessions, fetchSessions, deleteSessionFromCloud } from './services/firebaseService';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile, Language, ChatSession, Scheme, LockerDocument, Application, Message } from './types';
import { translations } from './translations';

const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="4" y="4" width="16" height="16" rx="8" fill="currentColor" fillOpacity="0.2" />
    <circle cx="12" cy="12" r="5" fill="currentColor" />
  </svg>
);

const ClarityLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 md:w-8 md:h-8">
    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#2563EB" />
  </svg>
);

const EligibilityLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 md:w-8 md:h-8">
    <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="#059669" />
  </svg>
);

const MultiLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 md:w-8 md:h-8">
    <path d="M12.87 15.07L10.33 12.56L10.36 12.53C12.1 10.59 13.34 8.36 14.07 6H17V4H10V2H8V4H1V6H12.17C11.5 7.92 10.44 9.75 9 11.35C8.07 10.32 7.3 9.19 6.69 8H4.69C5.42 9.63 6.42 11.17 7.67 12.56L2.58 17.58L4 19L9 14L12.11 17.11L12.87 15.07Z" fill="#7C3AED" />
  </svg>
);

const DEFAULT_DOC_TYPES = [
  "Aadhaar Card", "PAN Card", "Voter ID", "Ration Card", 
  "Driving License", "Birth Certificate", "Caste Certificate", "Income Certificate"
];

const MOCK_APPLICATIONS: Application[] = [
  { id: 'app-1', schemeName: 'PM-Kisan Samman Nidhi', status: 'Approved', progress: 100, lastUpdated: '2 days ago' },
  { id: 'app-2', schemeName: 'Ayushman Bharat Yojana', status: 'Submitted', progress: 65, lastUpdated: 'Today' },
  { id: 'app-3', schemeName: 'Skill India Mission', status: 'Pending', progress: 20, lastUpdated: '1 week ago' }
];

type AppViewState = 'landing' | 'auth' | 'dashboard' | 'loading';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<AppViewState>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLockerModal, setShowLockerModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('sahayak_language');
    return (saved as Language) || 'en';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('sahayak_theme');
    return saved === 'dark';
  });

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [bookmarks, setBookmarks] = useState<Scheme[]>([]);
  const [lockerDocuments, setLockerDocuments] = useState<LockerDocument[]>([]);

  const [applications] = useState<Application[]>(MOCK_APPLICATIONS);
  const [lockerSearch, setLockerSearch] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  const t = translations[language] || translations['en'];

  const notify = (message: string, type: ToastType = 'info') => setToast({ message, type });

  // 1. Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!currentUser && viewState !== 'loading') {
          notify(translations[language].loginSuccess || "Logged in successfully!", "success");
        }
        setCurrentUser(user);
        await hydrateUserData(user.uid);
        setViewState('dashboard');
      } else {
        if (currentUser && viewState === 'dashboard') {
          notify(translations[language].logoutConfirm ? "Logged out" : "Logged out successfully", "info");
        }
        setCurrentUser(null);
        if (viewState === 'loading') {
           setViewState('landing');
        }
      }
    });
    return unsubscribe;
  }, [currentUser, viewState, language]);

  // 2. Data Hydration from Firestore
  const hydrateUserData = async (uid: string) => {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      let cloudProfile: UserProfile | null = null;
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        cloudProfile = data.profile || null;
        setProfile(cloudProfile);
        setBookmarks(data.bookmarks || []);
        
        // Fetch saved enquiries/sessions from the sessions sub-collection
        const cloudSessions = await fetchSessions(uid);
        setSessions(cloudSessions);
        
        if (cloudSessions.length > 0 && !activeSessionId) {
          setActiveSessionId(cloudSessions[0].id);
        } else if (cloudProfile && cloudSessions.length === 0) {
          createNewSession(cloudProfile);
        }

        const storedLocker = data.locker || [];
        const mergedLocker = DEFAULT_DOC_TYPES.map(type => {
            const found = storedLocker.find((d: any) => d.name === type);
            return found || {
                id: `doc-${type.toLowerCase().replace(/\s/g, '-')}`,
                type,
                name: type,
                isCustom: false
            };
        });
        
        const customDocs = storedLocker.filter((d: any) => d.isCustom);
        setLockerDocuments([...mergedLocker, ...customDocs]);
      } else {
        setLockerDocuments(DEFAULT_DOC_TYPES.map(type => ({
          id: `doc-${type.toLowerCase().replace(/\s/g, '-')}`,
          type,
          name: type,
          isCustom: false
        })));
      }
    } catch (err) {
      console.error("Hydration error:", err);
      notify("Failed to fetch cloud data. Working locally.", "error");
    }
  };

  // 3. Real-time Cloud Sync Effect (Debounced)
  // This ensures that any change to sessions, bookmarks, or locker is pushed to Firestore automatically.
  useEffect(() => {
    if (currentUser && profile) {
      const timer = setTimeout(async () => {
        setIsSyncing(true);
        try {
          await syncProfile(currentUser.uid, profile);
          await syncUserData(currentUser.uid, { bookmarks, locker: lockerDocuments });
          
          // Only sync if there are sessions to save
          if (sessions.length > 0) {
            await syncSessions(currentUser.uid, sessions);
          }
        } catch (err) {
          console.error("Persistence error:", err);
        } finally {
          setIsSyncing(false);
        }
      }, 2000); // 2-second debounce for responsiveness
      return () => clearTimeout(timer);
    }
  }, [profile, sessions, bookmarks, lockerDocuments, currentUser]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sahayak_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sahayak_theme', 'light');
    }
  }, [isDarkMode]);

  const createNewSession = (userProfile: UserProfile) => {
    const id = Date.now().toString();
    const currentT = translations[language] || translations['en'];
    const newSession: ChatSession = {
      id,
      title: 'New Enquiry',
      lastModified: new Date(),
      messages: [
        {
          id: 'welcome-' + id,
          role: 'model',
          content: currentT.welcome(userProfile.name, userProfile.state, userProfile.income),
          timestamp: new Date(),
          quickReplies: [currentT.suggestBtn, currentT.howToUseBtn]
        }
      ]
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(id);
  };

  const handleDeleteSession = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId('');
    }
    if (currentUser) {
      try {
        await deleteSessionFromCloud(currentUser.uid, id);
        notify("Conversation deleted from cloud", "info");
      } catch (err) {
        notify("Deleted locally. Sync pending...", "info");
      }
    }
  };

  const handleProfileSave = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    setShowProfileModal(false);
    
    if (currentUser) {
      setIsSyncing(true);
      try {
        await syncProfile(currentUser.uid, newProfile);
        notify(t.profileUpdated || "Profile Saved to Cloud", "success");
      } catch (err) {
        notify("Saved locally. Cloud sync pending...", "info");
      } finally {
        setIsSyncing(false);
      }
    } else {
      notify(t.profileUpdated || "Profile Updated Successfully", "success");
    }

    if (sessions.length === 0) createNewSession(newProfile);
  };

  const handleLogout = async () => {
    if (window.confirm(t.logoutConfirm)) {
      setIsSidebarOpen(false);
      await auth.signOut();
      setProfile(null);
      setSessions([]);
      setActiveSessionId('');
      setBookmarks([]);
      setLockerDocuments([]);
      setViewState('landing');
    }
  };

  const toggleBookmark = (scheme: Scheme) => {
    setBookmarks(prev => {
      const isBookmarked = prev.some(b => b.id === scheme.id);
      if (isBookmarked) {
        notify(t.bookmarkRemoved, "info");
        return prev.filter(b => b.id !== scheme.id);
      } else {
        notify(t.bookmarkAdded, "success");
        return [...prev, scheme];
      }
    });
  };

  const updateActiveSessionMessages = (newMessages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        let newTitle = s.title;
        // Dynamically update the session title based on the first user query
        if (s.title === 'New Enquiry' || !s.title) {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            newTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
          }
        }
        return { ...s, messages: newMessages, lastModified: new Date(), title: newTitle };
      }
      return s;
    }));
  };

  const handleGoHome = () => setViewState('landing');
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Locker Methods
  const handleUploadDoc = (id: string) => {
    setActiveDocId(id);
    fileInputRef.current?.click();
  };

  const handleDownloadDoc = (doc: LockerDocument) => {
    if (!doc.data) return;
    try {
      const link = document.createElement('a');
      link.href = doc.data;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify(`Downloading ${doc.name}...`, "success");
    } catch (err) {
      notify("Download failed. Please try again.", "error");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeDocId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        setLockerDocuments(prev => prev.map(doc => 
          doc.id === activeDocId 
            ? { ...doc, data: base64Data, mimeType: file.type, lastUpdated: new Date() } 
            : doc
        ));
        setActiveDocId(null);
        notify(`${file.name} stored in locker`, "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const addCustomDoc = () => {
    if (!newDocName.trim()) return;
    const newDoc: LockerDocument = {
      id: `custom-${Date.now()}`,
      type: "Custom",
      name: newDocName,
      isCustom: true
    };
    setLockerDocuments(prev => [...prev, newDoc]);
    setNewDocName("");
    notify("Custom folder created", "success");
  };

  const removeDoc = (id: string) => {
    const docToRemove = lockerDocuments.find(d => d.id === id);
    if (!docToRemove) return;

    if (!docToRemove.isCustom && docToRemove.data) {
        setLockerDocuments(prev => prev.map(d => 
            d.id === id ? { ...d, data: undefined, lastUpdated: undefined, mimeType: undefined } : d
        ));
    } else if (docToRemove.isCustom) {
        setLockerDocuments(prev => prev.filter(d => d.id !== id));
    }
    notify("Document removed from locker", "info");
  };

  if (viewState === 'loading') {
    return (
      <div className={`h-[100dvh] w-full flex flex-col items-center justify-center transition-all duration-700 ${isDarkMode ? 'bg-[#020617]' : 'bg-[#f1f5f9]'}`}>
        <div className="w-20 h-20 bg-blue-600 rounded-[24px] flex items-center justify-center mb-8 shadow-2xl animate-pulse">
           <LogoIcon />
        </div>
        <div className="flex space-x-2">
           <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
           <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></div>
           <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></div>
        </div>
        <span className={`mt-4 text-[10px] font-black uppercase tracking-[4px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Hydrating...</span>
      </div>
    );
  }

  if (viewState === 'landing') {
    return (
      <div className={`h-[100dvh] w-full flex items-center justify-center p-0 md:p-3 relative overflow-hidden transition-all duration-700 ${isDarkMode ? 'bg-[#020617]' : 'bg-[#f1f5f9]'}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full blur-[100px] transition-all ${isDarkMode ? 'bg-blue-600/10' : 'bg-blue-600/20'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full blur-[100px] transition-all ${isDarkMode ? 'bg-indigo-600/10' : 'bg-indigo-600/20'}`}></div>

        <div className="max-w-3xl w-full z-10 flex flex-col justify-center items-center h-full md:h-auto">
          <div className={`glass-panel p-6 md:p-12 lg:p-14 rounded-none md:rounded-[64px] shadow-2xl border transition-all ${isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-white/60 border-white/40'} text-center flex flex-col items-center h-full md:max-h-[95dvh] w-full overflow-hidden justify-center`}>
            
            <div className="w-16 h-16 md:w-18 md:h-18 bg-blue-600 text-white p-4 rounded-[24px] flex items-center justify-center mb-6 md:mb-6 shadow-2xl border border-white/20">
              <LogoIcon />
            </div>
            
            <h1 className={`text-4xl md:text-6xl font-black tracking-tighter mb-4 md:mb-5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t.brand}<span className="text-blue-600">.AI</span>
            </h1>
            
            <p className={`text-base md:text-xl leading-snug mb-8 md:mb-12 max-w-lg mx-auto font-medium opacity-80 px-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.tagline}
            </p>
            
            <div className="grid grid-cols-3 gap-3 md:gap-6 mb-10 w-full max-w-2xl px-4">
              <FeatureCard logo={<ClarityLogo />} title={t.clarity} desc={t.clarityDesc} isDarkMode={isDarkMode} colorClass="bg-blue-50 dark:bg-blue-900/20" />
              <FeatureCard logo={<EligibilityLogo />} title={t.eligibility} desc={t.eligibilityDesc} isDarkMode={isDarkMode} colorClass="bg-green-50 dark:bg-green-900/20" />
              <FeatureCard logo={<MultiLogo />} title={t.multi} desc={t.multiDesc} isDarkMode={isDarkMode} colorClass="bg-purple-50 dark:bg-purple-900/20" />
            </div>

            <div className="flex flex-col items-center space-y-6 md:space-y-6 w-full px-4">
              <button 
                onClick={() => setViewState('auth')}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black py-4 md:py-5 px-12 md:px-16 rounded-full text-lg md:text-xl transition-all shadow-2xl shadow-blue-600/30 active:scale-95"
              >
                {t.login}
              </button>
              
              <div className="flex items-center space-x-8">
                <div className="relative">
                  <select 
                    className={`bg-transparent border-none outline-none font-black text-xs md:text-sm uppercase tracking-widest cursor-pointer appearance-none ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                  >
                    <option value="en">English</option>
                    <option value="hi">हिंदी</option>
                    <option value="bn">বাংলা</option>
                    <option value="mr">मరాठी</option>
                    <option value="ta">தமிழ்</option>
                    <option value="te">తెలుగు</option>
                    <option value="pa">ਪੰਜਾਬੀ</option>
                  </select>
                </div>
                <button onClick={toggleTheme} className={`flex items-center space-x-3 px-5 py-2.5 rounded-full border transition-all ${isDarkMode ? 'border-white/10 text-slate-400 hover:text-white bg-white/5' : 'border-slate-200 text-slate-500 hover:text-slate-900 bg-black/5'}`}>
                  <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
                  <span className="text-xs font-black uppercase tracking-wider">{isDarkMode ? t.light : t.dark}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'auth') {
    return (
      <div className={`h-[100dvh] w-full flex items-center justify-center p-0 md:p-3 relative overflow-hidden transition-all duration-700 ${isDarkMode ? 'bg-[#020617]' : 'bg-[#f1f5f9]'}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full blur-[100px] transition-all ${isDarkMode ? 'bg-blue-600/10' : 'bg-blue-600/20'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full blur-[100px] transition-all ${isDarkMode ? 'bg-indigo-600/10' : 'bg-indigo-600/20'}`}></div>
        <AuthScreen 
          language={language} 
          isDarkMode={isDarkMode} 
          onSuccess={() => setViewState('dashboard')} 
          onBack={() => setViewState('landing')} 
          onLanguageChange={setLanguage}
          onToggleTheme={toggleTheme}
          onNotify={notify}
        />
      </div>
    );
  }

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const filteredLockerDocs = lockerDocuments.filter(d => 
    d.name.toLowerCase().includes(lockerSearch.toLowerCase())
  );

  return (
    <div className={`h-[100dvh] flex flex-col transition-all duration-700 overflow-hidden ${isDarkMode ? 'mesh-gradient-dark text-slate-100' : 'mesh-gradient-light text-slate-900'}`}>
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      <Header 
        profile={profile} 
        language={language}
        onLanguageChange={setLanguage}
        onEditProfile={() => setShowProfileModal(true)} 
        onLogout={handleLogout}
        onRestart={() => {}} 
        onGoHome={handleGoHome}
        onToggleTheme={toggleTheme}
        onOpenMenu={() => setIsSidebarOpen(true)}
        isDarkMode={isDarkMode}
        isSyncing={isSyncing}
      />

      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onDeleteSession={handleDeleteSession}
        onNewChat={() => profile && createNewSession(profile)}
        isDarkMode={isDarkMode}
        language={language}
        onLogout={handleLogout}
        bookmarks={bookmarks}
        onOpenLocker={() => setShowLockerModal(true)}
        applications={applications}
      />
      
      <main className="flex-1 overflow-hidden relative container mx-auto px-2 py-2 flex flex-col">
        {!profile ? (
          <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
            <div className={`glass-panel p-6 md:p-10 rounded-[48px] md:rounded-[60px] shadow-2xl max-w-xl w-full border transition-all overflow-y-auto max-h-full ${isDarkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white/70 border-white/40'}`}>
              <div className="mb-6">
                <h2 className={`text-2xl md:text-3xl font-extrabold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.profile}</h2>
                <p className={`text-xs md:text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.profileDesc}</p>
              </div>
              <ProfileForm onSave={handleProfileSave} isDarkMode={isDarkMode} language={language} />
            </div>
          </div>
        ) : (
          <div className={`flex-1 max-w-5xl mx-auto w-full glass-panel rounded-[40px] md:rounded-[56px] shadow-2xl overflow-hidden border transition-all flex flex-col ${isDarkMode ? 'bg-slate-950/40 border-white/5' : 'bg-white/70 border-white/50'}`}>
            {activeSession ? (
              <ChatInterface 
                key={activeSessionId}
                profile={profile} 
                isDarkMode={isDarkMode} 
                language={language} 
                initialMessages={activeSession.messages}
                onMessagesUpdate={updateActiveSessionMessages}
                bookmarks={bookmarks}
                onToggleBookmark={toggleBookmark}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-40">
                <div className="w-20 h-20 bg-blue-600/20 text-blue-600 rounded-3xl flex items-center justify-center">
                  <i className="fas fa-comments text-3xl"></i>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-black uppercase tracking-widest">No Active Enquiry</h3>
                  <p className="text-sm font-bold">Start a new conversation to get started.</p>
                </div>
                <button 
                  onClick={() => createNewSession(profile)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-500/30"
                >
                  Start New Enquiry
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {showProfileModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl p-4 transition-all ${isDarkMode ? 'bg-black/60' : 'bg-slate-900/20'}`}>
          <div className={`p-6 md:p-10 rounded-[48px] md:rounded-[60px] shadow-2xl max-w-xl w-full relative border transition-all overflow-y-auto max-h-[90dvh] ${isDarkMode ? 'bg-slate-900/90 border-white/10' : 'bg-white/95 border-white/60'}`}>
            <button onClick={() => setShowProfileModal(false)} className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><i className="fas fa-times"></i></button>
            <ProfileForm initialData={profile!} onSave={handleProfileSave} isDarkMode={isDarkMode} language={language} />
          </div>
        </div>
      )}

      {showLockerModal && (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-3xl p-2 md:p-6 transition-all animate-in fade-in duration-300 ${isDarkMode ? 'bg-black/80' : 'bg-slate-900/40'}`}>
          <div className={`w-full max-w-5xl h-[95dvh] md:h-[90dvh] flex flex-col rounded-[40px] md:rounded-[64px] border shadow-2xl overflow-hidden relative transition-all ${isDarkMode ? 'bg-slate-950 border-white/5' : 'bg-white border-white/60'}`}>
            <div className={`p-6 md:p-10 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <div>
                <h2 className={`text-2xl md:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.lockerTitle}</h2>
                <p className={`text-xs md:text-sm font-bold opacity-40 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t.lockerDesc}</p>
              </div>
              <button 
                onClick={() => setShowLockerModal(false)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 shadow-sm'}`}
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className={`p-6 md:px-10 py-4 flex flex-col md:flex-row gap-4 bg-opacity-50 ${isDarkMode ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                <div className="flex-1 relative">
                    <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 opacity-30 text-xs"></i>
                    <input 
                        type="text" 
                        placeholder={t.searchDocs} 
                        className={`w-full pl-12 pr-6 py-3.5 rounded-full border transition-all outline-none font-bold text-sm ${isDarkMode ? 'bg-white/5 border-white/10 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-600 shadow-sm'}`}
                        value={lockerSearch}
                        onChange={(e) => setLockerSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder={t.customDocName} 
                        className={`flex-1 md:w-56 px-6 py-3.5 rounded-full border transition-all outline-none font-bold text-sm ${isDarkMode ? 'bg-white/5 border-white/10 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-600 shadow-sm'}`}
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                    />
                    <button 
                        onClick={addCustomDoc}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-full font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                    >
                        {t.addDoc}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {filteredLockerDocs.map((doc) => (
                        <div 
                            key={doc.id} 
                            className={`p-6 rounded-[32px] border transition-all flex flex-col group relative ${isDarkMode ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-white border-slate-200 hover:shadow-xl hover:border-blue-100'}`}
                        >
                            <div className={`absolute top-4 right-4 text-[7px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${doc.data ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                                {doc.data ? t.docStored : t.docMissing}
                            </div>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 ${doc.data ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                                <i className={`fas ${doc.data ? (doc.mimeType?.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image') : 'fa-file-import'} text-xl`}></i>
                            </div>
                            <h3 className={`text-sm md:text-base font-black truncate mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{doc.name}</h3>
                            <p className="text-[9px] font-black uppercase opacity-20 tracking-wider mb-8">{doc.type}</p>
                            <div className="mt-auto flex gap-2">
                                <button 
                                    onClick={() => handleUploadDoc(doc.id)}
                                    className={`flex-1 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${doc.data ? (isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200') : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'}`}
                                >
                                    {doc.data ? 'Update' : t.uploadDoc}
                                </button>
                                {doc.data && (
                                    <>
                                      <button 
                                          onClick={() => handleDownloadDoc(doc)}
                                          className={`w-11 h-10 flex items-center justify-center rounded-full transition-all ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                          title="Download Document"
                                      >
                                          <i className="fas fa-download text-xs"></i>
                                      </button>
                                      <button 
                                          onClick={() => removeDoc(doc.id)}
                                          className={`w-11 h-10 flex items-center justify-center rounded-full transition-all ${isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                                          title="Remove Document"
                                      >
                                          <i className="fas fa-trash-alt text-xs"></i>
                                      </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredLockerDocs.length === 0 && (
                        <div className="col-span-full py-20 text-center opacity-20 flex flex-col items-center">
                            <i className="fas fa-folder-open text-6xl mb-6"></i>
                            <p className="font-black uppercase tracking-[4px]">No Documents Found</p>
                        </div>
                    )}
                </div>
            </div>
            <input type="file" className="hidden" ref={fileInputRef} onChange={onFileChange} accept="image/*,application/pdf" />
          </div>
        </div>
      )}
    </div>
  );
};

interface FeatureCardProps {
  logo: React.ReactNode;
  title: string;
  desc: string;
  isDarkMode: boolean;
  colorClass: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ logo, title, desc, isDarkMode, colorClass }) => (
  <div className={`p-4 md:p-6 rounded-[32px] md:rounded-[48px] border transition-all flex flex-col items-center text-center gap-2 md:gap-3 group ${isDarkMode ? 'bg-slate-800/30 border-white/5' : 'bg-white/40 border-white/60'}`}>
    <div className={`w-10 h-10 md:w-14 md:h-14 flex-shrink-0 rounded-full flex items-center justify-center shadow-md ${colorClass}`}>
      {logo}
    </div>
    <div className="space-y-1">
      <h3 className={`font-black text-[10px] md:text-base tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
      <p className={`hidden md:block text-[10px] md:text-xs leading-tight font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{desc}</p>
    </div>
  </div>
);

export default App;
