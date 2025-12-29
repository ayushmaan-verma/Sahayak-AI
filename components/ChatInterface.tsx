
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Message, Language, Scheme } from '../types';
import { getGeminiChat, analyzeDocument, textToSpeech, processAudioInput, suggestSchemes } from '../services/geminiService';
import { GenerateContentResponse } from "@google/genai";
import { translations } from '../translations';

interface ChatInterfaceProps {
  profile: UserProfile;
  isDarkMode: boolean;
  language: Language;
  initialMessages: Message[];
  onMessagesUpdate: (messages: Message[]) => void;
  bookmarks: Scheme[];
  onToggleBookmark: (scheme: Scheme) => void;
}

interface PendingAttachment {
  data: string;
  mimeType: string;
  name: string;
}

type InfoType = 'docs' | 'contact' | 'dates' | 'links' | 'eligibility' | 'apply';

const VOICE_PLACEHOLDER = "VOICE_MESSAGE_INTERNAL_PLACEHOLDER";

const ChatInterface: React.FC<ChatInterfaceProps> = ({ profile, isDarkMode, language, initialMessages, onMessagesUpdate, bookmarks, onToggleBookmark }) => {
  const t = translations[language];

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [activeInfo, setActiveInfo] = useState<{ id: string; type: InfoType } | null>(null);
  const [currentlyNarratingId, setCurrentlyNarratingId] = useState<string | null>(null);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const narrationQueueRef = useRef<string[]>([]);
  const isNarrationCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    onMessagesUpdate(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isRecording, activeInfo]);

  useEffect(() => {
    return () => {
      stopCurrentNarration();
    };
  }, []);

  const formatContent = (content: string) => {
    if (!content) return '';
    return content.replace(/\\n/g, '\n');
  };

  const stopCurrentNarration = () => {
    isNarrationCancelledRef.current = true;
    if (activeAudioSourceRef.current) {
      try { activeAudioSourceRef.current.stop(); } catch (e) {}
      activeAudioSourceRef.current = null;
    }
    narrationQueueRef.current = [];
    setCurrentlyNarratingId(null);
    setIsPreparingAudio(false);
  };

  const decodeAndPlayBuffer = async (base64: string): Promise<void> => {
    if (isNarrationCancelledRef.current) return;
    const binaryString = atob(base64.split(',')[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioContextRef.current.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return new Promise((resolve) => {
      if (isNarrationCancelledRef.current) { resolve(); return; }
      const source = audioContextRef.current!.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current!.destination);
      source.onended = () => { activeAudioSourceRef.current = null; resolve(); };
      activeAudioSourceRef.current = source;
      source.start();
    });
  };

  const handleSpeak = async (msg: Message) => {
    if (currentlyNarratingId === msg.id) { stopCurrentNarration(); return; }
    stopCurrentNarration();
    isNarrationCancelledRef.current = false;
    setCurrentlyNarratingId(msg.id);
    setIsPreparingAudio(true);
    const chunks = msg.content.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [msg.content];
    narrationQueueRef.current = chunks.map(c => c.trim()).filter(c => c.length > 0);
    try {
      while (narrationQueueRef.current.length > 0 && !isNarrationCancelledRef.current) {
        const currentChunk = narrationQueueRef.current.shift();
        if (!currentChunk) continue;
        const audioUrl = await textToSpeech(currentChunk);
        if (audioUrl && !isNarrationCancelledRef.current) {
          setIsPreparingAudio(false);
          await decodeAndPlayBuffer(audioUrl);
        }
      }
    } catch (err) {
      console.error("Narration error:", err);
    } finally {
      if (!isNarrationCancelledRef.current) {
        setCurrentlyNarratingId(null);
        setIsPreparingAudio(false);
      }
    }
  };

  const handleSend = async (customInput?: string) => {
    const messageContent = (customInput || input).trim();
    const attachment = pendingAttachment;
    if (!messageContent && !attachment) return;

    const isSuggestionRequest = messageContent === t.suggestBtn;
    let displayContent = (messageContent || `Analyzing document: ${attachment?.name}`);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: displayContent, timestamp: new Date(), attachments: attachment ? [attachment.data] : undefined };

    const historySnapshot = [...messages];
    setMessages(prev => [...prev, userMessage]);
    
    setInput('');
    setPendingAttachment(null);
    setIsLoading(true);
    setIsTyping(true);

    try {
      if (attachment) {
        const result = await analyzeDocument(attachment.data.split(',')[1], attachment.mimeType, profile, language);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: result.summary,
          docMetadata: { 
            requiredDocuments: result.requiredDocuments, 
            contactInfo: result.contactInfo,
            importantDates: result.importantDates,
            importantLinks: result.importantLinks,
            eligibilityCriteria: result.eligibilityCriteria,
            howToApply: result.howToApply,
            isValidScheme: result.isValidScheme
          },
          timestamp: new Date(),
        }]);
      } else if (isSuggestionRequest) {
        const result = await suggestSchemes(profile, language);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: result.intro,
          schemes: result.schemes,
          type: 'suggestions',
          timestamp: new Date(),
        }]);
      } else {
        const chatInstance = getGeminiChat(profile, historySnapshot, language);
        const stream = await chatInstance.sendMessageStream({ message: messageContent });
        const assistantId = (Date.now() + 1).toString();
        
        setMessages(prev => [...prev, { id: assistantId, role: 'model', content: "", timestamp: new Date() }]);
        setIsLoading(false);
        
        let responseText = "";
        for await (const chunk of stream) {
          const text = (chunk as GenerateContentResponse).text;
          if (text) {
            responseText += text;
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: responseText } : m));
          }
        }
        
        const lowerText = responseText.toLowerCase();
        if (lowerText.includes("?") && (lowerText.includes("yes") || lowerText.includes("no"))) {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, quickReplies: ["Yes", "No", "Not Sure"] } : m));
        }
      }
    } catch (error: any) {
      console.error("Sahayak.AI interaction error:", error);
      const errorMsg = error?.message?.includes("API key") ? "Invalid API Key. Please check your configuration." : "Sahayak.AI connection error. Please refresh and try again.";
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: errorMsg, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const startEligibilityCheck = (msg: Message) => {
    const naturalPrompt = `I've reviewed the document for this scheme. Can you help me check if I am eligible for it based on my profile (Age: ${profile.age}, Income: ₹${profile.income}, Category: ${profile.category})?`;
    handleSend(naturalPrompt);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const tempUserMsgId = Date.now().toString();
        setMessages(prev => [...prev, { id: tempUserMsgId, role: 'user', content: VOICE_PLACEHOLDER, timestamp: new Date() }]);
        setIsLoading(true);
        setIsTyping(true);

        const reader = new FileReader();
        reader.readAsDataURL(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        reader.onloadend = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const result = await processAudioInput(base64Data, 'audio/webm', profile, language);
            setMessages(prev => prev.map(m => m.id === tempUserMsgId ? { ...m, transcription: result.transcription, content: result.transcription } : m));
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: result.answer, timestamp: new Date() }]);
          } catch (err) {
            console.error("Audio processing failed:", err);
            setMessages(prev => prev.map(m => m.id === tempUserMsgId ? { ...m, content: "⚠️ Transcription Failed" } : m));
          } finally {
            setIsLoading(false);
            setIsTyping(false);
          }
        };
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("Microphone blocked. Please check permissions."); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPendingAttachment({ data: reader.result as string, mimeType: file.type, name: file.name });
      reader.readAsDataURL(file);
    }
  };

  const SchemeCard: React.FC<{ scheme: Scheme }> = ({ scheme }) => {
    const isBookmarked = bookmarks.some(b => b.id === scheme.id);

    return (
      <div className={`flex flex-col rounded-[32px] md:rounded-[48px] overflow-hidden border transition-all duration-500 hover:shadow-2xl hover:translate-y-[-4px] group h-full ${isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'}`}>
        <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? 'bg-blue-600/10 border-white/5' : 'bg-blue-50/50 border-blue-100/50'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 transform group-hover:rotate-6 transition-transform">
              <i className="fas fa-landmark text-sm"></i>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[2px] ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>{scheme.category || 'Welfare'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => onToggleBookmark(scheme)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md active:scale-90 ${isBookmarked ? 'bg-blue-600 text-white shadow-blue-500/40' : isDarkMode ? 'bg-white/5 text-slate-400 hover:text-blue-400' : 'bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
              title={isBookmarked ? t.bookmarkRemoved : t.bookmarkAdded}
            >
              <i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark text-sm`}></i>
            </button>
            {scheme.link && (
              <a href={scheme.link} target="_blank" rel="noopener noreferrer" className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md ${isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:text-blue-600 hover:text-white'}`}>
                <i className="fas fa-external-link-alt text-[10px]"></i>
              </a>
            )}
          </div>
        </div>
        
        <div className="p-6 md:p-8 space-y-6 flex-1 flex flex-col">
          <div className="space-y-3">
            <h3 className={`text-xl md:text-2xl font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{scheme.name}</h3>
            <div className={`p-4 rounded-[28px] ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
              <p className={`text-sm leading-relaxed font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{scheme.description}</p>
            </div>
          </div>

          <div className={`p-5 rounded-[32px] ${isDarkMode ? 'bg-emerald-500/5' : 'bg-emerald-50'}`}>
            <h4 className={`text-[10px] font-black uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
              <i className="fas fa-award text-[10px]"></i> Benefits
            </h4>
            <ul className="space-y-3">
              {scheme.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <i className={`fas fa-check-circle mt-1 text-[10px] ${isDarkMode ? 'text-emerald-500' : 'text-emerald-600'}`}></i>
                  <span className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`p-5 rounded-[32px] border ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-50/50 border-indigo-100'}`}>
            <h4 className={`text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
              <i className="fas fa-fingerprint text-[10px]"></i> Personal Fit
            </h4>
            <p className={`text-sm font-bold leading-relaxed italic ${isDarkMode ? 'text-slate-400' : 'text-indigo-900'}`}>
              "{scheme.whyItFits}"
            </p>
          </div>

          <div className="pt-4 mt-auto">
            <button 
              onClick={() => handleSend(`How do I apply for ${scheme.name}?`)}
              className={`w-full py-5 rounded-full text-[11px] font-black uppercase tracking-[2px] transition-all flex items-center justify-center gap-3 active:scale-95 ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white border border-white/5' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20'}`}
            >
              <span>Learn How to Apply</span>
              <i className="fas fa-arrow-right text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderInfoPanel = (msg: Message) => {
    if (!activeInfo || activeInfo.id !== msg.id || !msg.docMetadata) return null;

    const data = msg.docMetadata;
    let content: React.ReactNode = null;
    let title = "";
    let icon = "";
    let colorClass = "";

    switch (activeInfo.type) {
      case 'apply':
        title = "Step-by-Step Application";
        icon = "fa-wand-magic-sparkles";
        colorClass = "text-blue-500";
        content = (
          <ul className="space-y-4">
            {data.howToApply?.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">{i + 1}</span>
                <p className="text-sm font-bold opacity-80">{step}</p>
              </li>
            ))}
          </ul>
        );
        break;
      case 'eligibility':
        title = "Eligibility Requirements";
        icon = "fa-list-check";
        colorClass = "text-emerald-500";
        content = (
          <ul className="space-y-3">
            {data.eligibilityCriteria?.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <i className="fas fa-check-double mt-1 text-emerald-500 text-xs"></i>
                <p className="text-sm font-bold opacity-80">{item}</p>
              </li>
            ))}
          </ul>
        );
        break;
      case 'docs':
        title = "Required Documents";
        icon = "fa-file-invoice";
        colorClass = "text-purple-500";
        content = (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.requiredDocuments?.map((doc, i) => (
              <div key={i} className={`p-4 rounded-3xl border flex items-center gap-3 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <i className="fas fa-file-circle-check text-purple-500"></i>
                <span className="text-sm font-bold opacity-80">{doc}</span>
              </div>
            ))}
          </div>
        );
        break;
      case 'dates':
        title = "Important Dates";
        icon = "fa-calendar-day";
        colorClass = "text-amber-500";
        content = (
          <ul className="space-y-4">
            {data.importantDates?.map((date, i) => (
              <li key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0"><i className="fas fa-clock"></i></div>
                <p className="text-sm font-bold opacity-80">{date}</p>
              </li>
            ))}
          </ul>
        );
        break;
      case 'links':
        title = "Important Links";
        icon = "fa-link";
        colorClass = "text-cyan-500";
        content = (
          <div className="space-y-3">
            {data.importantLinks?.map((link, i) => (
              <a key={i} href={link} target="_blank" rel="noopener noreferrer" className={`p-4 rounded-3xl border flex items-center justify-between group transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <i className="fas fa-globe text-cyan-500"></i>
                  <span className="text-sm font-bold opacity-80 truncate">{link}</span>
                </div>
                <i className="fas fa-arrow-up-right-from-square text-[10px] opacity-0 group-hover:opacity-40 transition-opacity"></i>
              </a>
            ))}
          </div>
        );
        break;
      case 'contact':
        title = "Customer Care / Helpdesk";
        icon = "fa-headset";
        colorClass = "text-rose-500";
        content = (
          <div className={`p-6 rounded-3xl border leading-loose font-bold whitespace-pre-wrap ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-rose-50 border-rose-100'}`}>
            {data.contactInfo}
          </div>
        );
        break;
    }

    return (
      <div className={`mt-6 p-6 rounded-[32px] border animate-in slide-in-from-top-4 duration-500 ${isDarkMode ? 'bg-slate-900/60 border-white/10 shadow-2xl shadow-black/40' : 'bg-white border-slate-300 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-current opacity-10 ${colorClass}`}></div>
            <i className={`fas ${icon} absolute translate-x-3 text-lg ${colorClass}`}></i>
            <h4 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h4>
          </div>
          <button onClick={() => setActiveInfo(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"><i className="fas fa-times text-xs opacity-40"></i></button>
        </div>
        {content}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            <div className={`max-w-[85%] md:max-w-[80%] space-y-2 ${msg.type === 'suggestions' ? 'w-full !max-w-full' : ''}`}>
              <div className={`p-5 md:p-6 rounded-[40px] shadow-xl relative transition-all glass-panel border ${msg.role === 'user' ? 'bg-blue-600/90 text-white rounded-tr-none border-white/20' : isDarkMode ? 'bg-slate-800/70 text-slate-100 rounded-tl-none border-white/5' : 'bg-white/95 text-slate-900 rounded-tl-none border-slate-300'}`}>
                {msg.attachments && (
                  <div className="mb-4 rounded-[32px] overflow-hidden border border-white/10 shadow-inner">
                    {msg.attachments[0].startsWith('data:image') ? <img src={msg.attachments[0]} alt="Doc" className="max-h-64 w-full object-contain bg-black/10 p-2" /> : <div className="flex items-center space-x-3 p-4 bg-black/5"><i className="fas fa-file-pdf text-xl text-red-500"></i><span className="text-xs font-bold opacity-80">Document Attachment</span></div>}
                  </div>
                )}
                
                <div className="whitespace-pre-wrap leading-relaxed md:leading-loose text-sm md:text-base font-medium tracking-tight">
                  {msg.content === VOICE_PLACEHOLDER ? (msg.transcription || "Transcription pending...") : formatContent(msg.content)}
                </div>

                {msg.schemes && msg.schemes.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 mt-10">
                    {msg.schemes.map((scheme) => (
                      <SchemeCard key={scheme.id} scheme={scheme} />
                    ))}
                  </div>
                )}

                {msg.docMetadata?.isValidScheme && (
                  <div className="mt-6 flex flex-wrap gap-2 pt-6 border-t border-black/10 dark:border-white/5">
                    <button 
                      onClick={() => startEligibilityCheck(msg)} 
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all backdrop-blur-md shadow-lg active:scale-95 border flex items-center space-x-2 ${isDarkMode ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border-emerald-400/30' : 'bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-900 border-emerald-600/30 shadow-emerald-600/10'}`}
                    >
                      <i className="fas fa-id-card-clip text-xs"></i><span>Check Eligibility</span>
                    </button>

                    <button 
                      onClick={() => setActiveInfo(activeInfo?.id === msg.id && activeInfo?.type === 'apply' ? null : { id: msg.id, type: 'apply' })} 
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all backdrop-blur-md shadow-sm border flex items-center space-x-2 ${activeInfo?.id === msg.id && activeInfo?.type === 'apply' ? 'bg-blue-600 text-white border-blue-400' : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-200/50 border-slate-300 text-slate-800'}`}
                    >
                      <i className="fas fa-wand-magic-sparkles text-xs"></i><span>How To Apply</span>
                    </button>

                    <button 
                      onClick={() => setActiveInfo(activeInfo?.id === msg.id && activeInfo?.type === 'eligibility' ? null : { id: msg.id, type: 'eligibility' })} 
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all backdrop-blur-md shadow-sm border flex items-center space-x-2 ${activeInfo?.id === msg.id && activeInfo?.type === 'eligibility' ? 'bg-emerald-600 text-white border-emerald-400' : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-200/50 border-slate-300 text-slate-800'}`}
                    >
                      <i className="fas fa-list-check text-xs"></i><span>Eligibility Criteria</span>
                    </button>

                    <button 
                      onClick={() => setActiveInfo(activeInfo?.id === msg.id && activeInfo?.type === 'docs' ? null : { id: msg.id, type: 'docs' })} 
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all backdrop-blur-md shadow-sm border flex items-center space-x-2 ${activeInfo?.id === msg.id && activeInfo?.type === 'docs' ? 'bg-purple-600 text-white border-purple-400' : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-200/50 border-slate-300 text-slate-800'}`}
                    >
                      <i className="fas fa-file-invoice text-xs"></i><span>Required Documents</span>
                    </button>

                    <button 
                      onClick={() => setActiveInfo(activeInfo?.id === msg.id && activeInfo?.type === 'dates' ? null : { id: msg.id, type: 'dates' })} 
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all backdrop-blur-md shadow-sm border flex items-center space-x-2 ${activeInfo?.id === msg.id && activeInfo?.type === 'dates' ? 'bg-amber-500 text-white border-amber-400' : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-200/50 border-slate-300 text-slate-800'}`}
                    >
                      <i className="fas fa-calendar-day text-xs"></i><span>Important Dates</span>
                    </button>

                    <button 
                      onClick={() => setActiveInfo(activeInfo?.id === msg.id && activeInfo?.type === 'links' ? null : { id: msg.id, type: 'links' })} 
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all backdrop-blur-md shadow-sm border flex items-center space-x-2 ${activeInfo?.id === msg.id && activeInfo?.type === 'links' ? 'bg-cyan-600 text-white border-cyan-400' : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-200/50 border-slate-300 text-slate-800'}`}
                    >
                      <i className="fas fa-link text-xs"></i><span>Important Links</span>
                    </button>

                    <button 
                      onClick={() => setActiveInfo(activeInfo?.id === msg.id && activeInfo?.type === 'contact' ? null : { id: msg.id, type: 'contact' })} 
                      className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all backdrop-blur-md shadow-sm border flex items-center space-x-2 ${activeInfo?.id === msg.id && activeInfo?.type === 'contact' ? 'bg-rose-600 text-white border-rose-400' : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-200/50 border-slate-300 text-slate-800'}`}
                    >
                      <i className="fas fa-headset text-xs"></i><span>Customer Care</span>
                    </button>
                  </div>
                )}

                {renderInfoPanel(msg)}

                {msg.role === 'model' && msg.content && msg.content !== "" && (
                  <button onClick={() => handleSpeak(msg)} className={`mt-3 flex items-center space-x-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase transition-all backdrop-blur-md active:scale-95 ${currentlyNarratingId === msg.id ? 'bg-red-500/40 text-white border-red-400/50' : isDarkMode ? 'bg-blue-400/10 text-blue-400 border-blue-500/20' : 'bg-blue-600/10 text-blue-700 border-blue-600/30 hover:bg-blue-600/20'}`}>
                    <i className={`fas ${currentlyNarratingId === msg.id ? 'fa-stop' : 'fa-volume-up'}`}></i><span>{currentlyNarratingId === msg.id ? (isPreparingAudio ? 'Preparing...' : 'Stop') : t.narrate}</span>
                  </button>
                )}
              </div>
              
              {msg.quickReplies && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {msg.quickReplies.map(qr => (
                    <button key={qr} onClick={() => handleSend(qr)} className={`px-6 py-2.5 rounded-full border backdrop-blur-md font-black text-[10px] uppercase transition-all shadow-sm active:scale-95 ${isDarkMode ? 'border-blue-400/30 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white' : 'border-blue-600/30 bg-blue-600/5 text-blue-800 hover:bg-blue-600 hover:text-white'}`}>
                      {qr}
                    </button>
                  ))}
                </div>
              )}
              <div className={`text-[10px] font-black uppercase tracking-widest px-4 ${isDarkMode ? 'opacity-40' : 'opacity-60 text-slate-500'}`}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className={`glass-panel border px-5 py-3 rounded-full flex items-center space-x-3 backdrop-blur-xl ${isDarkMode ? 'bg-slate-800/40 border-white/10' : 'bg-white/80 border-slate-300 shadow-lg'}`}><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.1s]"></div><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div><span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-blue-500' : 'text-blue-700'}`}>{t.thinking}</span></div></div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 pb-3 md:px-8 md:pb-8 pt-3 flex flex-col gap-3">
        {isRecording && <div className={`mx-auto max-w-xl w-full flex items-center justify-between px-8 py-4 rounded-full backdrop-blur-2xl border shadow-2xl ${isDarkMode ? 'bg-red-500/15 border-red-500/30' : 'bg-red-50/80 border-red-300'}`}><div className="flex space-x-2 h-8">{[...Array(8)].map((_, i) => <div key={i} className="w-1.5 bg-red-500 rounded-full animate-bounce" style={{ height: `${30+Math.random()*70}%`, animationDelay: `${i*0.1}s` }}></div>)}</div><span className="text-sm font-black text-red-600 uppercase tracking-widest">{t.listening}</span><button onClick={stopRecording} className="w-10 h-10 rounded-full bg-red-600 text-white shadow-lg active:scale-90 transition-transform"><i className="fas fa-stop"></i></button></div>}
        <div className={`max-w-4xl mx-auto glass-panel p-2 md:p-3 rounded-[32px] shadow-2xl border flex flex-col w-full backdrop-blur-2xl transition-all ${isDarkMode ? 'bg-slate-900/40 border-white/10' : 'bg-white/90 border-slate-300 shadow-slate-200/50'}`}>
          {pendingAttachment && <div className={`mx-2 mb-2 p-3 rounded-[24px] border flex items-center justify-between backdrop-blur-md ${isDarkMode ? 'bg-slate-800/40 border-white/10' : 'bg-slate-100 border-slate-300'}`}><div className="flex items-center space-x-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-black/10 border-white/10' : 'bg-slate-200 border-slate-300'}`}>{pendingAttachment.mimeType.startsWith('image/') ? <img src={pendingAttachment.data} className="w-full h-full object-cover" /> : <i className="fas fa-file-pdf text-red-500"></i>}</div><div className="flex flex-col"><span className={`text-[10px] font-black uppercase truncate max-w-[150px] ${!isDarkMode && 'text-slate-900'}`}>{pendingAttachment.name}</span><span className={`text-[8px] font-black uppercase ${isDarkMode ? 'opacity-40' : 'text-slate-500'}`}>Ready To Scan</span></div></div><button onClick={() => setPendingAttachment(null)} className="text-slate-400 hover:text-red-500 w-8 h-8 flex items-center justify-center"><i className="fas fa-times"></i></button></div>}
          <div className="flex items-center space-x-2 md:space-x-4 px-2 md:px-3">
            <button onClick={() => fileInputRef.current?.click()} className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors border backdrop-blur-md ${isDarkMode ? 'bg-slate-800/30 text-slate-400 hover:text-blue-400 border-white/10' : 'bg-slate-100 text-slate-500 hover:text-blue-600 border-slate-300'}`}><i className="fas fa-paperclip"></i></button>
            <button onClick={isRecording ? stopRecording : startRecording} className={`w-11 h-11 flex items-center justify-center rounded-full transition-all border backdrop-blur-md ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' : isDarkMode ? 'bg-slate-800/30 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-300'}`}><i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i></button>
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" />
            <input type="text" placeholder={t.placeholder} className={`flex-1 bg-transparent border-none px-4 py-3 focus:outline-none font-bold text-sm md:text-base ${isDarkMode ? 'text-white placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
            <button onClick={() => handleSend()} disabled={!input.trim() && !pendingAttachment} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${input.trim() || pendingAttachment ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/40 active:scale-95' : isDarkMode ? 'bg-slate-800/30 text-slate-700 border-white/10' : 'bg-slate-100 text-slate-300 border-slate-200'}`}><i className="fas fa-paper-plane text-sm"></i></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
