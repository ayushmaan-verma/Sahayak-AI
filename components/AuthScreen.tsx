
import React from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebaseService';
import { Language } from '../types';
import { translations } from '../translations';

interface AuthScreenProps {
  language: Language;
  isDarkMode: boolean;
  onSuccess: () => void;
  onBack: () => void;
  onLanguageChange: (lang: Language) => void;
  onToggleTheme: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ 
  language, 
  isDarkMode, 
  onSuccess, 
  onBack, 
  onLanguageChange, 
  onToggleTheme,
  onNotify
}) => {
  const t = translations[language];
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const inputClasses = (hasError: boolean) => `w-full px-6 py-4 md:py-4.5 rounded-full border transition-all outline-none font-bold text-sm md:text-base ${
    isDarkMode 
      ? `bg-white/5 ${hasError ? 'border-rose-500/50' : 'border-white/10'} text-white focus:bg-white/10 focus:border-blue-500` 
      : `bg-slate-50 ${hasError ? 'border-rose-500/50' : 'border-slate-200'} text-slate-900 focus:bg-white focus:border-blue-600 shadow-sm`
  }`;

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleComingSoon = () => {
    if (onNotify) {
      onNotify(t.comingSoon, 'info');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            throw err;
        }
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md md:max-w-lg w-full animate-in fade-in slide-in-from-bottom-8 duration-700 px-4 relative">
      <div className="flex items-center justify-between mb-4 md:mb-6 px-2 md:px-4">
        <button onClick={onBack} className={`flex items-center space-x-2 text-[10px] md:text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          <i className="fas fa-arrow-left"></i><span>{t.back}</span>
        </button>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <select 
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className={`appearance-none bg-transparent outline-none font-black text-[9px] md:text-[10px] uppercase tracking-widest pl-3 pr-7 py-2 rounded-full border transition-all cursor-pointer ${ isDarkMode ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600' }`}
            >
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="bn">BN</option>
              <option value="mr">MR</option>
              <option value="ta">TA</option>
              <option value="te">TE</option>
              <option value="pa">PA</option>
            </select>
            <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[8px] pointer-events-none opacity-40"></i>
          </div>
          <button onClick={onToggleTheme} className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full border transition-all active:scale-90 ${isDarkMode ? 'border-white/10 text-slate-400 hover:text-white bg-white/5' : 'border-slate-200 text-slate-500 hover:text-slate-900 bg-black/5 shadow-sm'}`}>
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-[10px] md:text-xs`}></i>
          </button>
        </div>
      </div>

      <div className={`glass-panel p-6 md:p-12 lg:p-14 rounded-[48px] md:rounded-[64px] border shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900/80 border-white/10 shadow-black/40' : 'bg-white/95 border-white/60 shadow-slate-200/40'}`}>
        <div className="text-center mb-8 md:mb-10">
          <div className="w-14 h-14 md:w-20 md:h-20 bg-blue-600 text-white rounded-[18px] md:rounded-[28px] flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-2xl border border-white/20 transform hover:rotate-3 transition-transform">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 md:w-10 md:h-10"><circle cx="12" cy="12" r="5" fill="currentColor" /><rect x="4" y="4" width="16" height="16" rx="8" fill="currentColor" fillOpacity="0.2" /></svg>
          </div>
          <h2 className={`text-2xl md:text-4xl font-black mb-2 tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.login}</h2>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] md:text-xs font-black uppercase tracking-widest text-center">
            <i className="fas fa-exclamation-triangle mr-2"></i>{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 md:space-y-5 mb-8 md:mb-10">
          <input type="email" placeholder={t.emailPlaceholder} className={inputClasses(!!error)} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder={t.passwordPlaceholder} className={inputClasses(!!error)} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 md:py-5 rounded-full transition-all uppercase tracking-widest text-[11px] md:text-sm shadow-xl shadow-blue-600/20 active:scale-[0.98]">
            {isSubmitting ? 'Verifying...' : t.signIn}
          </button>
        </form>

        <div className="relative mb-8 md:mb-10 text-center">
          <div className={`absolute top-1/2 left-0 right-0 h-px ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}></div>
          <span className={`relative px-5 md:px-8 text-[9px] md:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-[#0f172a] text-slate-500' : 'bg-white text-slate-400'}`}>{t.or}</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button onClick={handleGoogleLogin} className={`w-full flex items-center justify-center space-x-3 py-3.5 md:py-4 rounded-full border transition-all active:scale-[0.98] ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm text-slate-900'}`}>
            <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            <span className="text-[9px] md:text-xs font-black uppercase tracking-widest">{t.google}</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleComingSoon} className={`flex items-center justify-center space-x-2 py-3.5 md:py-4 rounded-full border transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800 text-white border-white/10 hover:bg-slate-700' : 'bg-slate-900 text-white border-slate-900 hover:bg-black shadow-lg'}`}>
              <i className="fab fa-apple text-lg"></i>
              <span className="text-[9px] md:text-xs font-black uppercase tracking-widest">{t.apple}</span>
            </button>
            <button onClick={handleComingSoon} className={`flex items-center justify-center space-x-2 py-3.5 md:py-4 rounded-full border transition-all active:scale-[0.98] ${isDarkMode ? 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20' : 'bg-blue-50 border-blue-100 shadow-sm text-blue-800 hover:bg-blue-100'}`}>
              <i className="fas fa-id-card text-xs"></i>
              <span className="text-[9px] md:text-xs font-black uppercase tracking-widest">{t.digilocker}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
