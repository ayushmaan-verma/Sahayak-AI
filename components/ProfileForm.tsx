
import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { translations } from '../translations';

interface ProfileFormProps {
  onSave: (profile: UserProfile) => void;
  initialData?: UserProfile;
  isDarkMode: boolean;
  language: Language;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ onSave, initialData, isDarkMode, language }) => {
  const [formData, setFormData] = useState<UserProfile>(initialData || {
    name: '',
    age: 18,
    gender: '',
    income: 0,
    category: '',
    education: '',
    state: ''
  });

  const t = translations[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const inputClasses = `w-full px-6 py-3.5 md:px-8 md:py-4.5 rounded-full border transition-all outline-none font-black text-sm ${
    isDarkMode 
      ? 'bg-slate-800/60 border-white/10 text-white focus:border-blue-500 focus:bg-slate-800' 
      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600 focus:bg-white shadow-sm'
  }`;
  const labelClasses = `block text-[10px] font-black uppercase tracking-[2px] mb-2 ml-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`;

  const statesAndUTs = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep", "Delhi (NCT)", "Puducherry", "Jammu and Kashmir", "Ladakh", "Other"
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-2 gap-4 md:gap-6">
        <div className="col-span-2">
          <label className={labelClasses}>{t.nameLabel}</label>
          <input required type="text" className={inputClasses} placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
        </div>
        
        <div>
          <label className={labelClasses}>{t.ageLabel}</label>
          <input required type="number" className={inputClasses} value={formData.age} onChange={(e) => setFormData({...formData, age: parseInt(e.target.value)})} />
        </div>

        <div>
          <label className={labelClasses}>{t.genderLabel}</label>
          <select required className={inputClasses} value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value as any})}>
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelClasses}>{t.incomeLabel}</label>
          <input required type="number" className={inputClasses} placeholder="Annual Income" value={formData.income} onChange={(e) => setFormData({...formData, income: parseInt(e.target.value)})} />
        </div>

        <div>
          <label className={labelClasses}>{t.categoryLabel}</label>
          <select required className={inputClasses} value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value as any})}>
            <option value="">Select</option>
            <option value="General">General</option>
            <option value="OBC">OBC</option>
            <option value="SC">SC</option>
            <option value="ST">ST</option>
          </select>
        </div>

        <div>
          <label className={labelClasses}>{t.eduLabel}</label>
          <select required className={inputClasses} value={formData.education} onChange={(e) => setFormData({...formData, education: e.target.value as any})}>
            <option value="">Select</option>
            <option value="None">None</option>
            <option value="Primary">Primary</option>
            <option value="Secondary">Secondary</option>
            <option value="Graduate">Graduate</option>
            <option value="Post-Graduate">Post-Grad</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelClasses}>{t.stateLabel}</label>
          <select required className={inputClasses} value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})}>
            <option value="">Select State / UT</option>
            {statesAndUTs.map((location) => ( <option key={location} value={location}>{location}</option> ))}
          </select>
        </div>
      </div>

      <button 
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 md:py-6 rounded-full transition-all shadow-2xl shadow-blue-500/40 active:scale-95 mt-6 flex items-center justify-center space-x-4 group border border-white/10"
      >
        <span className="text-sm md:text-base uppercase tracking-widest">{t.accessBtn}</span>
        <i className="fas fa-sparkles text-xs transform group-hover:rotate-12 transition-transform"></i>
      </button>
    </form>
  );
};

export default ProfileForm;
