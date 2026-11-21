import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Wallet, Plus, PieChart, Settings, Share2, Calculator, Sparkles,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, LogOut,
  Check, X, Trash2, Download, Smartphone, ShieldCheck, MessageCircle,
  MessageCircleOff, Send, Edit3, Award, Users, HandCoins, Landmark,
  Utensils, Plane, ShoppingBag, Receipt, Film, HeartPulse, Home,
  ShoppingCart, Briefcase, Laptop, Gift, RotateCcw, Coins, ChevronRight,
  User, Mail, Lock, Eye, EyeOff, Cloud, Camera, Fuel, Bus, GraduationCap,
  Repeat, PiggyBank, Copy, CheckCircle2, Clock, Search, Calendar, Phone,
  FileText, History, Target, AlertCircle, Upload, Palette, Ticket, ScanLine,
  Split, Sparkle, RefreshCw
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

// ============================================================================
// 1. FIREBASE & ENVIRONMENT CONFIGURATION (VITE DEPLOY + RUNTIME FALLBACK)
// ============================================================================
let firebaseApp = null;
let auth = null;
let db = null;
let isFirebaseConfigured = false;

const getEnvVar = (key) => {
  try {
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) || '';
  } catch (_) {
    return '';
  }
};

const GEMINI_API_KEY = getEnvVar('VITE_GEMINI_API_KEY');
const appId = getEnvVar('VITE_FINORA_APP_ID') || (typeof __app_id !== 'undefined' ? __app_id : 'finora-wealth-pwa');

try {
  let resolvedConfig = null;
  const viteApiKey = getEnvVar('VITE_FIREBASE_API_KEY');

  if (viteApiKey) {
    resolvedConfig = {
      apiKey: viteApiKey,
      authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnvVar('VITE_FIREBASE_APP_ID')
    };
  } else if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    resolvedConfig = typeof __firebase_config === 'string'
      ? JSON.parse(__firebase_config)
      : __firebase_config;
  }

  if (resolvedConfig && resolvedConfig.apiKey) {
    firebaseApp = getApps().length === 0 ? initializeApp(resolvedConfig) : getApps()[0];
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    isFirebaseConfigured = true;
  }
} catch (err) {
  console.warn('Firebase initialization skipped or fallback active:', err);
}

// ============================================================================
// 2. COMPLETE FINORA CATEGORIES & ACTIVITY-SPECIFIC PANDA MOOD MAPPING
// ============================================================================
const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food & drinks', icon: Utensils, color: '#F59E0B', mood: 'foodie' },
  { id: 'groceries', label: 'Groceries', icon: ShoppingCart, color: '#10B981', mood: 'groceries' },
  { id: 'fuel', label: 'Petrol / fuel', icon: Fuel, color: '#F97316', mood: 'fuel' },
  { id: 'transport', label: 'Transport', icon: Bus, color: '#0EA5E9', mood: 'transport' },
  { id: 'travel', label: 'Travel', icon: Plane, color: '#06B6D4', mood: 'travel' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#EC4899', mood: 'shopping' },
  { id: 'bills', label: 'Bills & utilities', icon: Receipt, color: '#6366F1', mood: 'bills' },
  { id: 'education', label: 'Education', icon: GraduationCap, color: '#8B5CF6', mood: 'education' },
  { id: 'health', label: 'Health', icon: HeartPulse, color: '#EF4444', mood: 'health' },
  { id: 'entertainment', label: 'Entertainment', icon: Film, color: '#D946EF', mood: 'entertainment' },
  { id: 'rent', label: 'Rent / housing', icon: Home, color: '#14B8A6', mood: 'rent' },
  { id: 'subscriptions', label: 'Subscriptions', icon: Repeat, color: '#3B82F6', mood: 'subscriptions' },
  { id: 'savings_alloc', label: 'Group / Savings', icon: PiggyBank, color: '#22C55E', mood: 'savings' },
  { id: 'lend_emi', label: 'Lend / Loan EMI', icon: HandCoins, color: '#EAB308', mood: 'lend_emi' },
  { id: 'gift_exp', label: 'Gift', icon: Gift, color: '#F43F5E', mood: 'shopping' },
  { id: 'other_expense', label: 'Other', icon: Coins, color: '#94A3B8', mood: 'default' }
];

const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salary', icon: Briefcase, color: '#10B981', mood: 'rich_income' },
  { id: 'pocket_money', label: 'Pocket money / Allowance', icon: Sparkles, color: '#F59E0B', mood: 'pocket_money' },
  { id: 'freelance', label: 'Freelance', icon: Laptop, color: '#06B6D4', mood: 'rich_income' },
  { id: 'business', label: 'Business', icon: TrendingUp, color: '#3B82F6', mood: 'rich_income' },
  { id: 'refund', label: 'Refund', icon: RotateCcw, color: '#8B5CF6', mood: 'pocket_money' },
  { id: 'gift_inc', label: 'Gift', icon: Gift, color: '#EC4899', mood: 'pocket_money' },
  { id: 'interest', label: 'Interest', icon: Award, color: '#14B8A6', mood: 'rich_income' },
  { id: 'other_income', label: 'Other income', icon: Coins, color: '#22C55E', mood: 'rich_income' }
];

const ALL_CATEGORIES_MAP = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank Transfer', 'Wallet'];

// 12 Curated Finora Theme Packs
const THEME_PACKS = {
  'Midnight Luxe': {
    label: 'Midnight Luxe',
    desc: 'Deep navy & emerald-cyan cyber glow',
    bg: '#090D16',
    surface: '#111827',
    card: '#0F172A',
    border: '#1E293B',
    text: '#F8FAFC',
    muted: '#94A3B8',
    accent: '#06B6D4',
    accent2: '#10B981',
    isLight: false
  },
  'Obsidian': {
    label: 'Obsidian',
    desc: 'AMOLED black with electric magenta & gold',
    bg: '#07050C',
    surface: '#130D1C',
    card: '#1A1126',
    border: '#351F47',
    text: '#FAF5FF',
    muted: '#B69EC9',
    accent: '#E879F9',
    accent2: '#F59E0B',
    isLight: false
  },
  'Synthwave': {
    label: 'Synthwave',
    desc: 'Retro violet & sunset neon orange',
    bg: '#0F0A24',
    surface: '#19123B',
    card: '#21184D',
    border: '#3B2B73',
    text: '#F5F3FF',
    muted: '#B5A8D9',
    accent: '#A78BFA',
    accent2: '#FB923C',
    isLight: false
  },
  'Forest': {
    label: 'Forest',
    desc: 'Deep pine green & sage wealth tones',
    bg: '#061714',
    surface: '#0D2621',
    card: '#12332C',
    border: '#204A40',
    text: '#ECFDF5',
    muted: '#8EB8AA',
    accent: '#34D399',
    accent2: '#A3E635',
    isLight: false
  },
  'Deep Ocean': {
    label: 'Deep Ocean',
    desc: 'Abyssal blue & crisp turquoise',
    bg: '#061224',
    surface: '#0C1E38',
    card: '#12294A',
    border: '#1E3F6B',
    text: '#EFF6FF',
    muted: '#93B4D9',
    accent: '#38BDF8',
    accent2: '#2DD4BF',
    isLight: false
  },
  'Crimson': {
    label: 'Crimson',
    desc: 'Rich burgundy & warm rose coral',
    bg: '#180910',
    surface: '#260F1A',
    card: '#331423',
    border: '#522238',
    text: '#FFF1F2',
    muted: '#CC9BA6',
    accent: '#FB7185',
    accent2: '#FBBF24',
    isLight: false
  },
  'Lavender Glass': {
    label: 'Lavender Glass',
    desc: 'Soft lavender mist & royal indigo',
    bg: '#F4F5FF',
    surface: '#FFFFFF',
    card: '#F8F9FF',
    border: '#E0E3F5',
    text: '#172033',
    muted: '#64748B',
    accent: '#6366F1',
    accent2: '#10B981',
    isLight: true
  },
  'Mint Wealth': {
    label: 'Mint Wealth',
    desc: 'Calm mint & botanical emerald',
    bg: '#ECFDF5',
    surface: '#FFFFFF',
    card: '#F3FCF8',
    border: '#CBECE0',
    text: '#064E3B',
    muted: '#4B7A6B',
    accent: '#059669',
    accent2: '#0D9488',
    isLight: true
  },
  'Warm Sand': {
    label: 'Warm Sand',
    desc: 'Warm parchment & toasted caramel',
    bg: '#FDF8F2',
    surface: '#FFFFFF',
    card: '#FAF2E8',
    border: '#EBDCCB',
    text: '#382616',
    muted: '#856E58',
    accent: '#D97706',
    accent2: '#059669',
    isLight: true
  },
  'Warm Minimal': {
    label: 'Warm Minimal',
    desc: 'Cream linen & dusty rose',
    bg: '#F9F4F0',
    surface: '#FFFDFB',
    card: '#F5ECE6',
    border: '#E6D8D0',
    text: '#2E2322',
    muted: '#7D6B68',
    accent: '#DB2777',
    accent2: '#0D9488',
    isLight: true
  },
  'Dreamscape': {
    label: 'Dreamscape',
    desc: 'Pastel lilac & petal pink',
    bg: '#F7F0FF',
    surface: '#FFFAFF',
    card: '#F3E8FF',
    border: '#E4D2FA',
    text: '#2B1E40',
    muted: '#7A6894',
    accent: '#9333EA',
    accent2: '#EC4899',
    isLight: true
  },
  'Holographic': {
    label: 'Holographic',
    desc: 'Iridescent silver & periwinkle glass',
    bg: '#EDF2F9',
    surface: '#FAFCFF',
    card: '#E6EEF8',
    border: '#CFDCEE',
    text: '#1E293B',
    muted: '#64748B',
    accent: '#4F46E5',
    accent2: '#06B6D4',
    isLight: true
  }
};

const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: num % 1 === 0 ? 0 : 2
  }).format(num);
};

// ============================================================================
// 3. CUSTOM GEOMETRIC FINORA LOGO COMPONENT
// ============================================================================
const FinoraLogo = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <defs>
      <linearGradient id="finoraGrad1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="55%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="finoraGrad2" x1="8" y1="32" x2="32" y2="8" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#22D3EE" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#finoraGrad1)" fillOpacity="0.16" stroke="url(#finoraGrad1)" strokeWidth="1.75" />
    <path d="M12 27V14.5C12 13.1193 13.1193 12 14.5 12H27" stroke="url(#finoraGrad2)" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M12 20.5H23.5" stroke="#10B981" strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="27.5" cy="26.5" r="3.5" fill="#06B6D4" />
  </svg>
);

// ============================================================================
// 4. 3D HOLOGRAPHIC DRAGGABLE PANDA COMPANION WITH 17 ACTIVITY ANIMATIONS
// ============================================================================
const MOOD_VISUALS = {
  default: { ring: '#06B6D4', glow: 'rgba(6, 182, 212, 0.45)', badge: '🐼', anim: 'animate-float', label: 'Ready' },
  foodie: { ring: '#F59E0B', glow: 'rgba(245, 158, 11, 0.6)', badge: '🍔', anim: 'animate-belly-rub', label: 'Ate Full!' },
  groceries: { ring: '#10B981', glow: 'rgba(16, 185, 129, 0.6)', badge: '🥕', anim: 'animate-bounce-soft', label: 'Groceries' },
  fuel: { ring: '#F97316', glow: 'rgba(249, 115, 22, 0.65)', badge: '⛽', anim: 'animate-vroom', label: 'Fuel Up!' },
  transport: { ring: '#0EA5E9', glow: 'rgba(14, 165, 233, 0.6)', badge: '🚕', anim: 'animate-vroom', label: 'Commute' },
  travel: { ring: '#38BDF8', glow: 'rgba(56, 189, 248, 0.65)', badge: '✈️', anim: 'animate-float', label: 'Jetsetter' },
  shopping: { ring: '#EC4899', glow: 'rgba(236, 72, 153, 0.6)', badge: '🛍️', anim: 'animate-bounce-soft', label: 'Shopping' },
  bills: { ring: '#6366F1', glow: 'rgba(99, 102, 241, 0.6)', badge: '⚡', anim: 'animate-pulse', label: 'Bills Paid' },
  education: { ring: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.65)', badge: '🎓', anim: 'animate-float', label: 'Scholar' },
  health: { ring: '#EF4444', glow: 'rgba(239, 68, 68, 0.6)', badge: '💚', anim: 'animate-heartbeat', label: 'Healthy' },
  entertainment: { ring: '#D946EF', glow: 'rgba(217, 70, 239, 0.65)', badge: '🍿', anim: 'animate-bounce-soft', label: 'Showtime' },
  rent: { ring: '#14B8A6', glow: 'rgba(20, 184, 166, 0.6)', badge: '🏠', anim: 'animate-float', label: 'Cozy Home' },
  subscriptions: { ring: '#3B82F6', glow: 'rgba(59, 130, 246, 0.6)', badge: '📺', anim: 'animate-float', label: 'Subscribed' },
  savings: { ring: '#22C55E', glow: 'rgba(34, 197, 94, 0.65)', badge: '🐷', anim: 'animate-bounce-soft', label: 'Saving Up' },
  lend_emi: { ring: '#EAB308', glow: 'rgba(234, 179, 8, 0.6)', badge: '🤝', anim: 'animate-float', label: 'Settled' },
  rich_income: { ring: '#10B981', glow: 'rgba(16, 185, 129, 0.7)', badge: '💵', anim: 'animate-celebrate', label: 'Payday!' },
  pocket_money: { ring: '#FBBF24', glow: 'rgba(251, 191, 36, 0.7)', badge: '🎉', anim: 'animate-celebrate', label: 'Yay!' },
  sad: { ring: '#F43F5E', glow: 'rgba(244, 63, 94, 0.65)', badge: '💸', anim: 'animate-sad-shake', label: 'Overspent' }
};

const HolographicPandaBot = ({
  mood,
  pandaName,
  bubbleText,
  chatEnabled,
  onOpenCoach,
  onDismissBubble
}) => {
  const [pos, setPos] = useState({ x: 16, y: 118 });
  const [isDragging, setIsDragging] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const dragStartRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0, moved: false });

  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => ({
        x: Math.min(Math.max(10, prev.x), Math.max(10, window.innerWidth - 94)),
        y: Math.min(Math.max(72, prev.y), Math.max(72, window.innerHeight - 175))
      }));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initX: pos.x,
      initY: pos.y,
      moved: false
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragStartRef.current.startX;
      const dy = clientY - dragStartRef.current.startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragStartRef.current.moved = true;
      }

      const maxX = window.innerWidth - 90;
      const maxY = window.innerHeight - 170;
      const nextX = Math.min(Math.max(8, dragStartRef.current.initX + dx), maxX);
      const nextY = Math.min(Math.max(68, dragStartRef.current.initY + dy), maxY);

      setPos({ x: nextX, y: nextY });
      setTilt({
        ry: Math.max(-24, Math.min(24, dx * 0.22)),
        rx: Math.max(-24, Math.min(24, -dy * 0.22))
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setTilt({ rx: 0, ry: 0 });
      if (!dragStartRef.current.moved) {
        onOpenCoach();
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, onOpenCoach]);

  const theme = MOOD_VISUALS[mood] || MOOD_VISUALS.default;
  const isRightSide = typeof window !== 'undefined' && pos.x > window.innerWidth / 2;
  const isJoyful = ['rich_income', 'pocket_money', 'savings', 'shopping', 'entertainment'].includes(mood);

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: 'none'
      }}
      className="fixed z-40 select-none"
    >
      {/* Contextual Speech Bubble */}
      {chatEnabled && bubbleText && (
        <div
          className={`absolute bottom-full mb-2.5 w-60 sm:w-64 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-400/45 shadow-[0_8px_30px_rgba(6,182,212,0.28)] text-xs text-slate-100 leading-relaxed ${
            isRightSide ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-cyan-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {pandaName} • {theme.label}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismissBubble();
              }}
              className="text-slate-400 hover:text-white p-0.5"
              aria-label="Close bubble"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p>{bubbleText}</p>
          <div
            className={`absolute -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-cyan-400/45 rotate-45 ${
              isRightSide ? 'right-7' : 'left-7'
            }`}
          />
        </div>
      )}

      {/* 3D Holographic Panda Bot Container */}
      <div
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        style={{
          transform: `perspective(650px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${isDragging ? 1.09 : 1})`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
        }}
        className="relative w-21 h-21 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center"
        title={`Drag ${pandaName} anywhere or tap for AI Money Coach`}
      >
        {/* Rotating Holographic Ring */}
        <div
          style={{
            borderColor: theme.ring,
            boxShadow: `0 0 24px ${theme.glow}, inset 0 0 14px ${theme.glow}`
          }}
          className="w-20 h-20 rounded-full border-2 border-dashed animate-spin-slow opacity-85 absolute"
        />

        {/* Hologram Base Projection Beam */}
        <div
          style={{
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 72%)`
          }}
          className="absolute -bottom-1 w-16 h-5 rounded-full blur-sm"
        />

        {/* Single Character SVG: Multi-Activity Holographic Panda */}
        <div className={`relative w-16 h-16 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-300/45 flex items-center justify-center overflow-hidden shadow-inner ${theme.anim}`}>
          {/* Scanlines */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 z-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(34,211,238,0.4) 0px, rgba(34,211,238,0.4) 1px, transparent 1px, transparent 3px)'
            }}
          />

          <svg viewBox="0 0 100 100" className="w-15 h-15 relative z-10">
            {/* Background Activity Particles */}
            {mood === 'fuel' && (
              <g>
                <path d="M16 74 Q12 64 16 58 Q20 64 16 74 Z" fill="#F97316" />
                <path d="M84 70 Q80 60 84 54 Q88 60 84 70 Z" fill="#FB923C" />
                <circle cx="20" cy="40" r="2.5" fill="#FDBA74" />
                <circle cx="82" cy="36" r="2.5" fill="#FDBA74" />
              </g>
            )}
            {mood === 'rich_income' && (
              <g>
                <rect x="10" y="28" width="12" height="7" rx="1.5" transform="rotate(-20 10 28)" fill="#10B981" stroke="#A7F3D0" strokeWidth="1" />
                <rect x="78" y="25" width="12" height="7" rx="1.5" transform="rotate(22 78 25)" fill="#10B981" stroke="#A7F3D0" strokeWidth="1" />
                <circle cx="15" cy="70" r="4" fill="#FBBF24" />
                <circle cx="85" cy="68" r="4" fill="#FBBF24" />
              </g>
            )}
            {mood === 'pocket_money' && (
              <g>
                <polygon points="15,24 19,32 11,32" fill="#F43F5E" />
                <polygon points="85,22 89,30 81,30" fill="#38BDF8" />
                <circle cx="16" cy="66" r="3.5" fill="#FBBF24" />
                <circle cx="84" cy="64" r="3.5" fill="#34D399" />
              </g>
            )}
            {mood === 'bills' && (
              <g>
                <polygon points="18,24 12,38 18,38 14,50 24,35 18,35" fill="#FBBF24" />
                <polygon points="82,24 76,38 82,38 78,50 88,35 82,35" fill="#FBBF24" />
              </g>
            )}

            {/* Panda Ears */}
            <g transform={mood === 'sad' ? 'rotate(-16 25 26)' : 'rotate(0 25 26)'}>
              <circle cx="24" cy="25" r="13" fill="#0F172A" stroke="#22D3EE" strokeWidth="2.4" />
              <circle cx="24" cy="25" r="5.5" fill="#22D3EE" fillOpacity="0.35" />
            </g>
            <g transform={mood === 'sad' ? 'rotate(16 75 26)' : 'rotate(0 75 26)'}>
              <circle cx="76" cy="25" r="13" fill="#0F172A" stroke="#22D3EE" strokeWidth="2.4" />
              <circle cx="76" cy="25" r="5.5" fill="#22D3EE" fillOpacity="0.35" />
            </g>

            {/* Headgear Props by Activity */}
            {mood === 'education' && (
              <g>
                <polygon points="50,6 22,18 50,28 78,18" fill="#1E1B4B" stroke="#A78BFA" strokeWidth="2" />
                <line x1="74" y1="19" x2="77" y2="33" stroke="#FBBF24" strokeWidth="2.2" />
                <circle cx="77" cy="34" r="2.5" fill="#FBBF24" />
              </g>
            )}

            {mood === 'travel' && (
              <g>
                <path d="M32 22 C35 10, 65 10, 68 22 Z" fill="#0284C7" stroke="#38BDF8" strokeWidth="2" />
                <path d="M25 22 H75" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
              </g>
            )}

            {mood === 'rent' && (
              <g>
                <path d="M24 24 L50 7 L76 24" fill="none" stroke="#2DD4BF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}

            {mood === 'health' && (
              <g>
                <rect x="42" y="10" width="16" height="11" rx="2.5" fill="#FFFFFF" stroke="#EF4444" strokeWidth="1.8" />
                <path d="M50 12.5 V18.5 M47 15.5 H53" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
              </g>
            )}

            {/* Panda Head */}
            <ellipse
              cx="50"
              cy="55"
              rx={mood === 'foodie' ? '37' : '34'}
              ry={mood === 'foodie' ? '32' : '31'}
              fill="#F8FAFC"
              stroke="#22D3EE"
              strokeWidth="2.4"
            />

            {/* Eye Patches */}
            <ellipse cx="36" cy="50" rx="10" ry="8" transform="rotate(-15 36 50)" fill="#0F172A" />
            <ellipse cx="64" cy="50" rx="10" ry="8" transform="rotate(15 64 50)" fill="#0F172A" />

            {/* Activity-Specific Eyes & Eyewear */}
            {mood === 'fuel' && (
              <>
                {/* Biker / Racing Goggles */}
                <rect x="23" y="42" width="23" height="14" rx="6" fill="#F97316" fillOpacity="0.85" stroke="#FED7AA" strokeWidth="2.2" />
                <rect x="54" y="42" width="23" height="14" rx="6" fill="#F97316" fillOpacity="0.85" stroke="#FED7AA" strokeWidth="2.2" />
                <line x1="46" y1="49" x2="54" y2="49" stroke="#FED7AA" strokeWidth="2.5" />
              </>
            )}

            {mood === 'entertainment' && (
              <>
                {/* 3D Red/Cyan Cinema Glasses */}
                <rect x="24" y="43" width="22" height="13" rx="3" fill="#EF4444" fillOpacity="0.85" stroke="#FFFFFF" strokeWidth="2" />
                <rect x="54" y="43" width="22" height="13" rx="3" fill="#06B6D4" fillOpacity="0.85" stroke="#FFFFFF" strokeWidth="2" />
                <line x1="46" y1="48" x2="54" y2="48" stroke="#FFFFFF" strokeWidth="2.2" />
              </>
            )}

            {mood === 'travel' && (
              <>
                {/* Aviator Sunglasses */}
                <rect x="25" y="43" width="21" height="13" rx="4" fill="#0284C7" stroke="#7DD3FC" strokeWidth="2" />
                <rect x="54" y="43" width="21" height="13" rx="4" fill="#0284C7" stroke="#7DD3FC" strokeWidth="2" />
                <line x1="46" y1="48" x2="54" y2="48" stroke="#7DD3FC" strokeWidth="2.2" />
              </>
            )}

            {mood === 'rich_income' && (
              <>
                {/* Glowing Star / Rupee Eyes */}
                <text x="36" y="54" textAnchor="middle" fontSize="13" fill="#34D399" fontWeight="bold">₹</text>
                <text x="64" y="54" textAnchor="middle" fontSize="13" fill="#34D399" fontWeight="bold">₹</text>
              </>
            )}

            {mood === 'foodie' && (
              <>
                <path d="M31 49 L40 51 L31 53" stroke="#FBBF24" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M69 49 L60 51 L69 53" stroke="#FBBF24" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}

            {mood === 'sad' && (
              <>
                <circle cx="36" cy="51" r="3.2" fill="#38BDF8" />
                <circle cx="64" cy="51" r="3.2" fill="#38BDF8" />
                <path d="M29 57 Q27 64 29 66 Q31 64 29 57 Z" fill="#38BDF8" />
                <path d="M71 57 Q69 64 71 66 Q73 64 71 57 Z" fill="#38BDF8" />
              </>
            )}

            {isJoyful && mood !== 'rich_income' && mood !== 'entertainment' && (
              <>
                <path d="M31 50 Q36 43 41 50" stroke="#34D399" strokeWidth="3" fill="none" strokeLinecap="round" />
                <path d="M59 50 Q64 43 69 50" stroke="#34D399" strokeWidth="3" fill="none" strokeLinecap="round" />
              </>
            )}

            {!['fuel', 'entertainment', 'travel', 'rich_income', 'foodie', 'sad'].includes(mood) && !isJoyful && (
              <>
                <circle cx="36" cy="50" r="3.5" fill="#22D3EE" />
                <circle cx="37.2" cy="48.8" r="1.2" fill="#FFFFFF" />
                <circle cx="64" cy="50" r="3.5" fill="#22D3EE" />
                <circle cx="65.2" cy="48.8" r="1.2" fill="#FFFFFF" />
              </>
            )}

            {/* Cheeks */}
            <ellipse
              cx="27"
              cy="60"
              rx={mood === 'foodie' ? '6.5' : '4.5'}
              ry={mood === 'foodie' ? '4.5' : '3'}
              fill={mood === 'foodie' ? '#F59E0B' : '#FB7185'}
              fillOpacity={mood === 'foodie' ? '0.68' : '0.45'}
            />
            <ellipse
              cx="73"
              cy="60"
              rx={mood === 'foodie' ? '6.5' : '4.5'}
              ry={mood === 'foodie' ? '4.5' : '3'}
              fill={mood === 'foodie' ? '#F59E0B' : '#FB7185'}
              fillOpacity={mood === 'foodie' ? '0.68' : '0.45'}
            />

            {/* Nose */}
            <ellipse cx="50" cy="59" rx="4.5" ry="3" fill="#0F172A" />

            {/* Mouth */}
            {mood === 'sad' ? (
              <path d="M42 72 Q50 64 58 72" stroke="#F43F5E" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            ) : isJoyful ? (
              <path d="M40 65 Q50 76 60 65 Z" fill="#10B981" stroke="#0F172A" strokeWidth="2" />
            ) : mood === 'foodie' ? (
              <path d="M43 66 Q46.5 70 50 66 Q53.5 70 57 66" stroke="#0F172A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M43 66 Q50 72 57 66" stroke="#0F172A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            )}

            {/* Foreground Handheld Props */}
            {mood === 'groceries' && (
              <g>
                <rect x="64" y="66" width="20" height="18" rx="3" fill="#10B981" stroke="#064E3B" strokeWidth="1.5" />
                <path d="M69 66 Q74 58 79 66" fill="none" stroke="#A7F3D0" strokeWidth="2" />
                <circle cx="71" cy="64" r="3" fill="#EF4444" />
                <rect x="76" y="60" width="3" height="6" fill="#F97316" />
              </g>
            )}
            {mood === 'savings' && (
              <g>
                <circle cx="75" cy="74" r="9" fill="#F472B6" stroke="#831843" strokeWidth="1.5" />
                <circle cx="75" cy="61" r="3.5" fill="#FBBF24" />
              </g>
            )}
          </svg>
        </div>

        {/* Floating Activity Emoji Pill */}
        <span
          style={{ borderColor: theme.ring }}
          className="absolute -top-1 -right-1 text-sm bg-slate-900/95 border rounded-full w-6 h-6 flex items-center justify-center shadow-lg"
        >
          {theme.badge}
        </span>

        {/* Holographic Name Tag */}
        <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-slate-950/90 text-cyan-300 border border-cyan-500/40 shadow">
          {pandaName}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// 5. FLOATING CALCULATOR MODAL (ACCESSIBLE ON ALL TABS + INJECT TO AMOUNT)
// ============================================================================
const FloatingCalculator = ({ isOpen, onClose, onApplyResult }) => {
  const [display, setDisplay] = useState('0');
  const [prevVal, setPrevVal] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState('');

  if (!isOpen) return null;

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearAll = () => {
    setDisplay('0');
    setPrevVal(null);
    setOperator(null);
    setWaitingForOperand(false);
    setHistory('');
  };

  const backspace = () => {
    if (waitingForOperand) return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const calculate = (first, second, op) => {
    switch (op) {
      case '+': return first + second;
      case '-': return first - second;
      case '×': return first * second;
      case '÷': return second === 0 ? 0 : first / second;
      default: return second;
    }
  };

  const handleOperator = (nextOp) => {
    const inputValue = parseFloat(display);

    if (prevVal === null) {
      setPrevVal(inputValue);
      setHistory(`${inputValue} ${nextOp}`);
    } else if (operator) {
      const currentValue = prevVal || 0;
      const newValue = Math.round(calculate(currentValue, inputValue, operator) * 10000) / 10000;
      setPrevVal(newValue);
      setDisplay(String(newValue));
      setHistory(`${newValue} ${nextOp}`);
    }

    setWaitingForOperand(true);
    setOperator(nextOp);
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);
    if (operator && prevVal !== null) {
      const newValue = Math.round(calculate(prevVal, inputValue, operator) * 10000) / 10000;
      setHistory(`${prevVal} ${operator} ${inputValue} =`);
      setDisplay(String(newValue));
      setPrevVal(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  };

  const handlePercent = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setDisplay(String(Math.round((val / 100) * 10000) / 10000));
    }
  };

  const buttons = [
    { label: 'C', action: clearAll, style: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    { label: '⌫', action: backspace, style: 'bg-slate-800 text-slate-200 border-slate-700' },
    { label: '%', action: handlePercent, style: 'bg-slate-800 text-cyan-300 border-slate-700' },
    { label: '÷', action: () => handleOperator('÷'), style: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { label: '7', action: () => inputDigit(7), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '8', action: () => inputDigit(8), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '9', action: () => inputDigit(9), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '×', action: () => handleOperator('×'), style: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { label: '4', action: () => inputDigit(4), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '5', action: () => inputDigit(5), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '6', action: () => inputDigit(6), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '-', action: () => handleOperator('-'), style: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { label: '1', action: () => inputDigit(1), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '2', action: () => inputDigit(2), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '3', action: () => inputDigit(3), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '+', action: () => handleOperator('+'), style: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { label: '00', action: () => inputDigit('00'), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '0', action: () => inputDigit(0), style: 'bg-slate-900 text-white border-slate-800' },
    { label: '.', action: inputDot, style: 'bg-slate-900 text-white border-slate-800' },
    { label: '=', action: handleEquals, style: 'bg-emerald-500 text-slate-950 font-bold border-emerald-400' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-3xl bg-[#0D1322] border border-slate-700/80 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
            <Calculator className="w-4 h-4" /> Quick Calculator
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-slate-800/80 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-slate-950/70 text-right">
          <div className="text-xs text-slate-400 h-4 truncate">{history || 'Ready'}</div>
          <div className="text-3xl font-bold text-white tracking-tight truncate mt-1">
            ₹{display}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 p-3">
          {buttons.map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              className={`h-12 rounded-2xl border text-base font-medium transition active:scale-95 ${btn.style}`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={() => {
              const numeric = Math.abs(parseFloat(display) || 0);
              if (numeric > 0) {
                onApplyResult(String(numeric));
              }
              onClose();
            }}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition"
          >
            Use ₹{display} in Transaction
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. AI MONEY COACH DRAWER (INCLUDES LEND/BORROW, LOANS, GROUP FUNDS & BUDGET)
// ============================================================================
const MoneyCoachModal = ({
  isOpen,
  onClose,
  pandaName,
  onRenamePanda,
  transactions,
  monthlyBudget,
  stats,
  lendSummary,
  loanSummary,
  groupsCount,
  chatEnabled,
  onToggleChat
}) => {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(pandaName);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    setNameInput(pandaName);
  }, [pandaName]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting =
        stats.budgetUsedPct > 85
          ? `Hey! I'm ${pandaName} 🐼. Heads up: you've used ${stats.budgetUsedPct}% of your ${formatCurrency(
              monthlyBudget
            )} budget (including group funds, lent money & EMIs). Want a quick saving plan?`
          : `Hi! I'm ${pandaName} 🐼, your holographic Money Coach! You have ${formatCurrency(
              lendSummary.toReceive
            )} to receive from friends and ${formatCurrency(loanSummary.monthlyEmi)} in monthly EMIs. Ask me anything!`;
      setMessages([{ role: 'assistant', text: greeting }]);
    }
  }, [isOpen, pandaName, stats.budgetUsedPct, monthlyBudget, lendSummary.toReceive, loanSummary.monthlyEmi, messages.length]);

  if (!isOpen) return null;

  const generateSmartCoachReply = async (userPrompt) => {
    const topCat = stats.categoryBreakdown[0];
    const localSummary = `Income: ₹${stats.totalIncome}, Total Expenses (all-inclusive): ₹${stats.totalExpense}, Net Balance: ₹${stats.balance}, Budget: ₹${monthlyBudget} (${stats.budgetUsedPct}% used), Friends Owe User: ₹${lendSummary.toReceive}, User Owes Friends: ₹${lendSummary.toRepay}, Loan Principal: ₹${loanSummary.totalPrincipal}, Monthly EMIs: ₹${loanSummary.monthlyEmi}, Active Groups: ${groupsCount}, Top Expense: ${
      topCat ? `${topCat.label} (₹${topCat.amount})` : 'None yet'
    }.`;

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: `User's complete Finora snapshot in INR: ${localSummary}\nTransactions logged: ${transactions.length}.\nUser question: ${userPrompt}`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: `You are ${pandaName}, a cute, encouraging holographic panda Money Coach inside Finora. Give concise, practical advice in 2-3 short sentences with Indian Rupee (₹) context.`
            }
          ]
        }
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (_) {}

    const q = userPrompt.toLowerCase();
    if (q.includes('lend') || q.includes('borrow') || q.includes('friend')) {
      return `Friends currently owe you ${formatCurrency(lendSummary.toReceive)} and you owe ${formatCurrency(
        lendSummary.toRepay
      )}. Use the WhatsApp nudge button in Lend & Loans to settle pending dues faster!`;
    }
    if (q.includes('loan') || q.includes('emi')) {
      return `Your total outstanding loan principal is ${formatCurrency(
        loanSummary.totalPrincipal
      )} with ${formatCurrency(loanSummary.monthlyEmi)}/mo in EMIs. Paying EMIs on time keeps your credit healthy!`;
    }
    if (q.includes('save') || q.includes('saving')) {
      return `To boost your savings above ${stats.savingsRate}%, try trimming ${
        topCat ? topCat.label : 'discretionary spending'
      } by 15% this week—saving around ${formatCurrency((topCat?.amount || 1000) * 0.15)}!`;
    }
    return `Your net cashflow is ${formatCurrency(stats.balance)} with ${stats.budgetUsedPct}% of your monthly budget used. ${
      topCat ? `Your top expense category is ${topCat.label} (${formatCurrency(topCat.amount)}).` : ''
    }`;
  };

  const handleSend = async (customText) => {
    const query = (customText || question).trim();
    if (!query || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setQuestion('');
    setLoading(true);
    const reply = await generateSmartCoachReply(query);
    setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#0D1322] border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-emerald-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-xl">
              🐼
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={18}
                    className="px-2 py-1 text-sm rounded-lg bg-slate-900 border border-cyan-400 text-white focus:outline-none w-32"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (nameInput.trim()) onRenamePanda(nameInput.trim());
                      setEditingName(false);
                    }}
                    className="p-1 rounded-lg bg-emerald-500 text-slate-950"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-white text-base">{pandaName} — AI Money Coach</h3>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-slate-400 hover:text-cyan-300 p-1"
                    title="Rename your Panda"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-cyan-300/80">Holographic Financial Companion</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-300 flex items-center gap-1.5">
            {chatEnabled ? <MessageCircle className="w-3.5 h-3.5 text-cyan-400" /> : <MessageCircleOff className="w-3.5 h-3.5 text-slate-500" />}
            Floating Chat Nudges
          </span>
          <button
            onClick={onToggleChat}
            className={`px-3 py-1 rounded-full font-semibold transition ${
              chatEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {chatEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[84%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-sm'
                    : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 text-cyan-300 text-xs animate-pulse">
                {pandaName} is crunching your numbers...
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-t border-slate-800/60">
          {['How can I save more?', 'Check lend & borrow', 'Loan EMI summary'].map((chip) => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              className="shrink-0 px-3 py-1 rounded-full text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask ${pandaName} for money advice...`}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 7. SOCIAL SHARE & CHART SCREENSHOT CARD GENERATOR
// ============================================================================
const ShareSnapshotModal = ({ isOpen, onClose, user, stats, pandaName, mood }) => {
  const [sharingStatus, setSharingStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  const generateCardImage = useCallback(() => {
    const canvas = document.createElement('canvas');
    const width = 900;
    const height = 1120;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090D16');
    bgGrad.addColorStop(0.5, '#0F172A');
    bgGrad.addColorStop(1, '#091926');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(36, 36, width - 72, height - 72, 36);
    ctx.stroke();

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('FINORA', 80, 110);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '22px sans-serif';
    ctx.fillText(
      `AI Wealth & Expense Snapshot • ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
      80,
      148
    );

    const badge = (MOOD_VISUALS[mood] || MOOD_VISUALS.default).badge;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(80, 180, width - 160, 84, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${user?.displayName || 'Finora Member'}`, 110, 230);

    ctx.fillStyle = '#22D3EE';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${badge} ${pandaName} Coach`, width - 110, 230);
    ctx.textAlign = 'left';

    const boxes = [
      { label: 'TOTAL INCOME', val: formatCurrency(stats.totalIncome), color: '#10B981' },
      { label: 'ALL EXPENSES', val: formatCurrency(stats.totalExpense), color: '#F43F5E' },
      { label: 'SAVINGS RATE', val: `${stats.savingsRate}%`, color: '#06B6D4' }
    ];

    boxes.forEach((box, idx) => {
      const bx = 80 + idx * 252;
      const by = 296;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.beginPath();
      ctx.roundRect(bx, by, 236, 130, 22);
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(box.label, bx + 22, by + 42);

      ctx.fillStyle = box.color;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(box.val, bx + 22, by + 92);
    });

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('All-Inclusive Expense Breakdown', 80, 495);

    const cx = 250;
    const cy = 690;
    const radius = 135;
    const innerRadius = 82;

    if (stats.categoryBreakdown.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 42;
      ctx.stroke();
    } else {
      let startAngle = -Math.PI / 2;
      stats.categoryBreakdown.forEach((cat) => {
        const sliceAngle = (cat.percentage / 100) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, (radius + innerRadius) / 2, startAngle, startAngle + sliceAngle);
        ctx.strokeStyle = cat.color;
        ctx.lineWidth = radius - innerRadius;
        ctx.stroke();
        startAngle += sliceAngle;
      });
    }

    ctx.fillStyle = '#94A3B8';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NET BALANCE', cx, cy - 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(formatCurrency(stats.balance), cx, cy + 26);
    ctx.textAlign = 'left';

    const topCategories = stats.categoryBreakdown.slice(0, 5);
    topCategories.forEach((cat, idx) => {
      const ly = 545 + idx * 66;
      const lx = 445;

      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.arc(lx, ly + 10, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(cat.label, lx + 24, ly + 17);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${formatCurrency(cat.amount)} (${cat.percentage}%)`, width - 85, ly + 17);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(lx + 24, ly + 28, 345, 10, 5);
      ctx.fill();

      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.roundRect(lx + 24, ly + 28, Math.max(12, (cat.percentage / 100) * 345), 10, 5);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.beginPath();
    ctx.roundRect(80, 945, width - 160, 88, 22);
    ctx.fill();

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Tracked with Finora — Smart Money Habits with Friends', 110, 997);

    return canvas;
  }, [user, stats, pandaName, mood]);

  useEffect(() => {
    if (isOpen) {
      const canvas = generateCardImage();
      setPreviewUrl(canvas.toDataURL('image/png'));
      setSharingStatus('');
    }
  }, [isOpen, generateCardImage]);

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    try {
      const canvas = generateCardImage();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'finora-expense-summary.png', { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Finora Expense & Savings Snapshot',
            text: `Check out my monthly money snapshot on Finora! Savings Rate: ${stats.savingsRate}% 🐼✨`,
            files: [file]
          });
          setSharingStatus('Shared successfully with friends!');
        } else {
          const link = document.createElement('a');
          link.download = 'finora-expense-summary.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
          setSharingStatus('Snapshot downloaded! Ready to send on WhatsApp or Instagram.');
        }
      }, 'image/png');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSharingStatus('Saved snapshot to device!');
      }
    }
  };

  const handleDownloadOnly = () => {
    const canvas = generateCardImage();
    const link = document.createElement('a');
    link.download = 'finora-expense-summary.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    setSharingStatus('High-res PNG saved to your gallery/downloads!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#0D1322] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold">
            <Share2 className="w-4 h-4 text-cyan-400" /> Share Chart Snapshot
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Finora Shareable Chart Card"
              className="w-full max-w-[290px] rounded-2xl border border-slate-700/80 shadow-xl"
            />
          )}
          {sharingStatus && (
            <p className="mt-3 text-xs text-emerald-400 font-medium text-center">{sharingStatus}</p>
          )}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 grid grid-cols-2 gap-3">
          <button
            onClick={handleDownloadOnly}
            className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-cyan-400" /> Save PNG
          </button>
          <button
            onClick={handleNativeShare}
            className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
          >
            <Share2 className="w-4 h-4" /> Share Now
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. DEDICATED CROSS-DEVICE LOGIN / SIGN-UP SCREEN
// ============================================================================
const AuthScreen = ({ onLocalLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    if (!isFirebaseConfigured || !auth) {
      setError('Cloud Google Sign-In requires Firebase config in this environment. Use Email & Password below to sync!');
      return;
    }
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message || 'Google Sign-In failed. Please try Email & Password.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter both your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        if (isSignUp) {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          if (name.trim()) {
            await updateProfile(cred.user, { displayName: name.trim() });
          }
        } else {
          await signInWithEmailAndPassword(auth, cleanEmail, password);
        }
      } else {
        onLocalLogin({
          uid: `user_${btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
          email: cleanEmail,
          displayName: name.trim() || cleanEmail.split('@')[0],
          isLocalFallback: true
        });
      }
    } catch (err) {
      setError(err.message?.replace('Firebase: ', '') || 'Authentication error. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md rounded-3xl bg-[#111827]/90 backdrop-blur-xl border border-slate-800/90 p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <FinoraLogo size={52} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-emerald-300 bg-clip-text text-transparent">
            Finora Wealth
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Make your money work with purpose • Synced across all devices
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 shadow-lg transition active:scale-98 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
          </svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">or with email</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Your Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                className="w-full pl-10 pr-11 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 hover:opacity-95 transition active:scale-98 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : isSignUp ? 'Create Cloud Account' : 'Sign In & Sync Data'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
          >
            {isSignUp ? 'Already have an account? Sign In' : "New to Finora? Create a Free Account"}
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>End-to-end synced • Sign in from any device</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 9. MAIN FINORA PROGRESSIVE WEB APPLICATION
// ============================================================================
export default function App() {
  // Auth & User State
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Navigation & Modal State
  // Tabs: 'dashboard' | 'transactions' | 'groups' | 'lend_loans' | 'insights'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isCoachOpen, setIsCoachOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  // Core Financial & Social Collections
  const [transactions, setTransactions] = useState([]);
  const [groupFunds, setGroupFunds] = useState([]);
  const [lendEntries, setLendEntries] = useState([]);
  const [loans, setLoans] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Preferences & Panda State
  const [monthlyBudget, setMonthlyBudget] = useState(25000);
  const [budgetDraft, setBudgetDraft] = useState('25000');
  const [activeThemeName, setActiveThemeName] = useState('Midnight Luxe');
  const [pandaName, setPandaName] = useState('Pando');
  const [pandaMood, setPandaMood] = useState('default');
  const [pandaBubble, setPandaBubble] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');

  // Add Transaction & Smart Ticket/Receipt Split State
  const [txType, setTxType] = useState('expense');
  const [txCategory, setTxCategory] = useState(EXPENSE_CATEGORIES[0].id);
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [txPaymentMethod, setTxPaymentMethod] = useState('UPI');
  const [txUtr, setTxUtr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [txFilterType, setTxFilterType] = useState('all');

  // AI Ticket / Receipt Scanner & Multi-Person Split State
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [scanSummary, setScanSummary] = useState('');
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitMembers, setSplitMembers] = useState(['']);
  const [splitPaidBy, setSplitPaidBy] = useState('me'); // 'me' or index string '0', '1', ...

  // CSV Bulk Import Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreviewRows, setCsvPreviewRows] = useState([]);
  const [csvError, setCsvError] = useState('');

  // Group Funding & Auto Bill-Splitter State
  const [groupSubTab, setGroupSubTab] = useState('my_groups');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTarget, setNewGroupTarget] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [contribGroupId, setContribGroupId] = useState('');
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');

  // Group Quick Bill-Splitter State
  const [billTitle, setBillTitle] = useState('');
  const [billTotal, setBillTotal] = useState('');
  const [billCategory, setBillCategory] = useState('food');
  const [billPeopleCount, setBillPeopleCount] = useState(3);
  const [billFriendNames, setBillFriendNames] = useState(['', '']);
  const [billPayer, setBillPayer] = useState('me');

  // Lend & Borrow + Loans Sub-tab & Form State
  const [socialSubTab, setSocialSubTab] = useState('lend'); // 'lend' | 'loans'
  const [lendDirection, setLendDirection] = useState('lent'); // 'lent' | 'borrowed'
  const [lendPerson, setLendPerson] = useState('');
  const [lendAmount, setLendAmount] = useState('');
  const [lendPurpose, setLendPurpose] = useState('');
  const [lendDueDate, setLendDueDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [lendPhone, setLendPhone] = useState('');

  // Loans & EMI Form State
  const [loanName, setLoanName] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanEmi, setLoanEmi] = useState('');
  const [loanRate, setLoanRate] = useState('');
  const [loanMonths, setLoanMonths] = useState('');
  const [loanNextDue, setLoanNextDue] = useState(() => new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);

  // Insights & Goals Sub-tab & Form State
  const [insightSubTab, setInsightSubTab] = useState('charts'); // 'charts' | 'goals' | 'settings'
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalAddMap, setGoalAddMap] = useState({});

  const triggerToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3200);
  }, []);

  // PWA Manifest Injection
  useEffect(() => {
    const manifestObj = {
      name: 'Finora — AI Expense & Wealth Tracker',
      short_name: 'Finora',
      start_url: '.',
      display: 'standalone',
      background_color: '#090D16',
      theme_color: '#090D16',
      icons: [
        {
          src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="%23090D16"/><path d="M30 70V35C30 32.2 32.2 30 35 30H70" stroke="%2310B981" stroke-width="9" stroke-linecap="round"/><path d="M30 52H60" stroke="%2306B6D4" stroke-width="9" stroke-linecap="round"/></svg>',
          sizes: '192x192',
          type: 'image/svg+xml'
        }
      ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifestObj)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = manifestUrl;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      URL.revokeObjectURL(manifestUrl);
    };
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) {
        console.warn('Custom token sign-in skipped:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Local Storage Helper for Offline/Fallback Mode
  const syncLocalState = useCallback((uid, key, data) => {
    try {
      localStorage.setItem(`finora_${key}_${uid}`, JSON.stringify(data));
    } catch (_) {}
  }, []);

  // Real-Time Firestore Listeners for All Collections
  useEffect(() => {
    if (!user) return;

    if (!isFirebaseConfigured || !db || user.isLocalFallback) {
      setSyncStatus('local');
      try {
        setTransactions(JSON.parse(localStorage.getItem(`finora_tx_${user.uid}`) || '[]'));
        setGroupFunds(JSON.parse(localStorage.getItem(`finora_groups_${user.uid}`) || '[]'));
        setLendEntries(JSON.parse(localStorage.getItem(`finora_lend_${user.uid}`) || '[]'));
        setLoans(JSON.parse(localStorage.getItem(`finora_loans_${user.uid}`) || '[]'));
        setSavingsGoals(JSON.parse(localStorage.getItem(`finora_goals_${user.uid}`) || '[]'));
        setAuditLogs(JSON.parse(localStorage.getItem(`finora_audit_${user.uid}`) || '[]'));
        const savedMeta = JSON.parse(localStorage.getItem(`finora_meta_${user.uid}`) || '{}');
        if (savedMeta.monthlyBudget) {
          setMonthlyBudget(savedMeta.monthlyBudget);
          setBudgetDraft(String(savedMeta.monthlyBudget));
        }
        if (savedMeta.themeName && THEME_PACKS[savedMeta.themeName]) {
          setActiveThemeName(savedMeta.themeName);
        }
        if (savedMeta.pandaName) setPandaName(savedMeta.pandaName);
        if (typeof savedMeta.chatEnabled === 'boolean') setChatEnabled(savedMeta.chatEnabled);
      } catch (_) {}
      return;
    }

    const userBase = ['artifacts', appId, 'users', user.uid];
    const unsubTx = onSnapshot(collection(db, ...userBase, 'transactions'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTransactions(list);
      setSyncStatus('synced');
    });

    // Public shared group funds so friends can collaborate via Group Code
    const unsubGroups = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'group_funds'), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((g) => g.creatorId === user.uid || (g.memberIds || []).includes(user.uid));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setGroupFunds(list);
    });

    const unsubLend = onSnapshot(collection(db, ...userBase, 'lend_borrow'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLendEntries(list);
    });

    const unsubLoans = onSnapshot(collection(db, ...userBase, 'loans'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLoans(list);
    });

    const unsubGoals = onSnapshot(collection(db, ...userBase, 'savings_goals'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSavingsGoals(list);
    });

    const unsubAudit = onSnapshot(collection(db, ...userBase, 'audit_logs'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAuditLogs(list.slice(0, 30));
    });

    const unsubMeta = onSnapshot(doc(db, ...userBase, 'settings', 'preferences'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.monthlyBudget) {
          setMonthlyBudget(Number(data.monthlyBudget));
          setBudgetDraft(String(data.monthlyBudget));
        }
        if (data.themeName && THEME_PACKS[data.themeName]) {
          setActiveThemeName(data.themeName);
        }
        if (data.pandaName) setPandaName(data.pandaName);
        if (typeof data.chatEnabled === 'boolean') setChatEnabled(data.chatEnabled);
      }
    });

    return () => {
      unsubTx();
      unsubGroups();
      unsubLend();
      unsubLoans();
      unsubGoals();
      unsubAudit();
      unsubMeta();
    };
  }, [user]);

  const recordAudit = async (actionText) => {
    if (!user) return;
    const entry = { action: actionText, createdAt: Date.now() };
    if (!isFirebaseConfigured || !db || user.isLocalFallback) {
      const next = [{ id: `aud_${Date.now()}`, ...entry }, ...auditLogs].slice(0, 30);
      setAuditLogs(next);
      syncLocalState(user.uid, 'audit', next);
    } else {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'audit_logs'), entry);
      } catch (_) {}
    }
  };

  const saveUserPreferences = async (updates) => {
    if (!user) return;
    if (!isFirebaseConfigured || !db || user.isLocalFallback) {
      const current = JSON.parse(localStorage.getItem(`finora_meta_${user.uid}`) || '{}');
      localStorage.setItem(`finora_meta_${user.uid}`, JSON.stringify({ ...current, ...updates }));
      return;
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'preferences'), updates, { merge: true });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  };

  // ==========================================================================
  // CORE TRANSACTION CREATOR + PANDA EMOTION ENGINE FOR EVERY ACTIVITY
  // ==========================================================================
  const triggerPandaForActivity = (type, categoryId, amount, customLabel) => {
    const catMeta = ALL_CATEGORIES_MAP[categoryId] || { label: customLabel || 'Activity', mood: 'default' };
    const nextTotalExpense = type === 'expense' ? stats.totalExpense + amount : stats.totalExpense;
    const isOverspending =
      type === 'expense' &&
      (nextTotalExpense > monthlyBudget * 0.9 || amount > monthlyBudget * 0.4);

    if (isOverspending) {
      setPandaMood('sad');
      setPandaBubble(
        `Whoa! Spending ${formatCurrency(amount)} on ${catMeta.label} pushes you to ${Math.round(
          (nextTotalExpense / Math.max(1, monthlyBudget)) * 100
        )}% of your budget! Let's slow down a bit.`
      );
      return;
    }

    setPandaMood(catMeta.mood || 'default');

    const messagesByMood = {
      fuel: `Fuel tank topped up with ${formatCurrency(amount)}! Ride safe out there! ⛽🏍️`,
      foodie: `Yum! Ate well! ${formatCurrency(amount)} logged for ${catMeta.label}. 🍔🧋`,
      groceries: `Fresh groceries stocked for ${formatCurrency(amount)}! Healthy kitchen vibes! 🛒🥕`,
      travel: `Bon voyage! ${formatCurrency(amount)} logged for your trip. Safe travels! ✈️🧳`,
      transport: `Smooth ride! ${formatCurrency(amount)} commute logged. 🚕🚇`,
      shopping: `Treat yourself! ${formatCurrency(amount)} shopping logged. 🛍️✨`,
      bills: `Bills paid on time (${formatCurrency(amount)})! Stress-free life! ⚡🧾`,
      education: `Investing in your brain! ${formatCurrency(amount)} for education. 🎓📚`,
      health: `Health is true wealth! ${formatCurrency(amount)} logged. Take care! 💚🩺`,
      entertainment: `Showtime! ${formatCurrency(amount)} for entertainment. Enjoy the vibe! 🍿🎬`,
      rent: `Home sweet home! ${formatCurrency(amount)} rent/housing logged. 🏠🔑`,
      subscriptions: `Subscription tracked (${formatCurrency(amount)}). Keep an eye on auto-renews! 📺`,
      savings: `Awesome! ${formatCurrency(amount)} added toward your group/savings fund! 🐷💰`,
      lend_emi: `Financial discipline! ${formatCurrency(amount)} recorded for Lend/EMI. 🤝`,
      rich_income: `Cha-ching! +${formatCurrency(amount)} ${catMeta.label} landed! Your wealth is growing! 💵🚀`,
      pocket_money: `Woohoo! +${formatCurrency(amount)} ${catMeta.label} received! Time to save smartly! 🎉✨`,
      default: `Logged ${formatCurrency(amount)} under ${catMeta.label}!`
    };

    setPandaBubble(messagesByMood[catMeta.mood] || messagesByMood.default);
  };

  const createTransactionEntry = async ({
    type,
    category,
    amount,
    note,
    date,
    paymentMethod = 'UPI',
    utr = '',
    skipPanda = false
  }) => {
    const newEntry = {
      type,
      category,
      amount: Number(amount),
      note: (note || '').trim(),
      date: date || new Date().toISOString().split('T')[0],
      paymentMethod,
      utr: (utr || '').trim(),
      createdAt: Date.now()
    };

    if (!isFirebaseConfigured || !db || user.isLocalFallback) {
      const updated = [{ id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...newEntry }, ...transactions];
      setTransactions(updated);
      syncLocalState(user.uid, 'tx', updated);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), newEntry);
    }

    if (!skipPanda) {
      triggerPandaForActivity(type, category, Number(amount));
    }
  };

  // ==========================================================================
  // COMPUTED FINANCIAL ANALYTICS (ALL-INCLUSIVE EXPENSES & CASHFLOW)
  // ==========================================================================
  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseByCat = {};

    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
        expenseByCat[t.category] = (expenseByCat[t.category] || 0) + amt;
      }
    });

    const balance = totalIncome - totalExpense;
    const savingsRate =
      totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;
    const budgetUsedPct =
      monthlyBudget > 0 ? Math.min(999, Math.round((totalExpense / monthlyBudget) * 100)) : 0;

    const categoryBreakdown = Object.entries(expenseByCat)
      .map(([catId, amount]) => {
        const meta = ALL_CATEGORIES_MAP[catId] || { label: catId, color: '#94A3B8' };
        return {
          id: catId,
          label: meta.label,
          color: meta.color,
          amount,
          percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      totalIncome,
      totalExpense,
      balance,
      savingsRate,
      budgetUsedPct,
      categoryBreakdown
    };
  }, [transactions, monthlyBudget]);

  const lendSummary = useMemo(() => {
    let toReceive = 0;
    let toRepay = 0;
    lendEntries.forEach((item) => {
      if (item.status === 'Pending') {
        if (item.direction === 'lent') toReceive += Number(item.amount) || 0;
        else toRepay += Number(item.amount) || 0;
      }
    });
    return { toReceive, toRepay };
  }, [lendEntries]);

  const loanSummary = useMemo(() => {
    let totalPrincipal = 0;
    let monthlyEmi = 0;
    loans.forEach((l) => {
      if ((Number(l.remainingMonths) || 0) > 0) {
        totalPrincipal += Number(l.principal) || 0;
        monthlyEmi += Number(l.emi) || 0;
      }
    });
    return { totalPrincipal, monthlyEmi };
  }, [loans]);

  // ==========================================================================
  // HANDLERS: TRANSACTIONS, GROUP FUNDING, LEND/BORROW, LOANS & GOALS
  // ==========================================================================
  const handleSwitchTxType = (nextType) => {
    setTxType(nextType);
    setTxCategory(nextType === 'expense' ? EXPENSE_CATEGORIES[0].id : INCOME_CATEGORIES[0].id);
    if (nextType === 'income') {
      setIsSplitEnabled(false);
    }
  };

  // Keep splitMembers array synchronized with splitCount (total people including "You")
  const updateTotalSplitPeople = (count) => {
    const safeCount = Math.max(2, Math.min(12, Number(count) || 2));
    setSplitCount(safeCount);
    const friendSlots = safeCount - 1;
    setSplitMembers((prev) => {
      const next = [...prev];
      while (next.length < friendSlots) next.push('');
      return next.slice(0, friendSlots);
    });
    if (splitPaidBy !== 'me' && Number(splitPaidBy) >= friendSlots) {
      setSplitPaidBy('me');
    }
  };

  // AI Multimodal Ticket & Receipt Scanner (Detects Movie Tickets, Bills, Member Count & Amount)
  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setReceiptPreview(dataUrl);
      setIsScanningReceipt(true);
      setScanSummary('');

      try {
        const base64Data = String(dataUrl).split(',')[1];
        const mimeType = file.type || 'image/jpeg';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

        const promptText = `Analyze this receipt, UPI screenshot, or movie/event ticket carefully.
Extract:
1. "amount": Total numeric amount paid (number only, e.g. 750).
2. "description": Short clear title (e.g. "Pushpa 2 Movie Tickets - PVR", "Dinner at Barbeque Nation", "HP Petrol").
3. "category": Exact match from: food, groceries, fuel, transport, travel, shopping, bills, education, health, entertainment, rent, subscriptions, other_expense. (Use "entertainment" for movie/cinema/concert tickets).
4. "date": YYYY-MM-DD if visible, otherwise empty string.
5. "utr": Transaction ID / Booking ID / UTR if visible, otherwise empty string.
6. "memberCount": How many people/tickets/seats/guests are shown on this ticket or bill? (e.g., if a movie ticket says "3 Tickets", "Admit 3", or lists 3 seat numbers like D4, D5, D6, return 3. If single person or unclear, return 1).
7. "reason": Brief 1-line note explaining what was detected (e.g. "Detected 3 movie tickets at PVR Cinemas").`;

        const payload = {
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptText },
                { inlineData: { mimeType, data: base64Data } }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                amount: { type: 'NUMBER' },
                description: { type: 'STRING' },
                category: { type: 'STRING' },
                date: { type: 'STRING' },
                utr: { type: 'STRING' },
                memberCount: { type: 'INTEGER' },
                reason: { type: 'STRING' }
              },
              required: ['amount', 'description', 'category', 'memberCount', 'reason']
            }
          }
        };

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Scanner unavailable');
        const jsonRes = await res.json();
        const rawText = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('No data extracted');

        const parsed = JSON.parse(rawText);
        setTxType('expense');
        if (parsed.amount > 0) setTxAmount(String(parsed.amount));
        if (parsed.description) setTxNote(parsed.description);
        if (parsed.category && ALL_CATEGORIES_MAP[parsed.category]) {
          setTxCategory(parsed.category);
        }
        if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
          setTxDate(parsed.date);
        }
        if (parsed.utr) setTxUtr(parsed.utr);

        const detectedMembers = Math.max(1, Number(parsed.memberCount) || 1);
        if (detectedMembers > 1) {
          setIsSplitEnabled(true);
          updateTotalSplitPeople(detectedMembers);
          setScanSummary(
            `🎟️ ${parsed.reason || `Detected ${detectedMembers} members`} — Enter your ${
              detectedMembers - 1
            } friend(s)' names & select who paid!`
          );
          setPandaMood(parsed.category === 'entertainment' ? 'entertainment' : 'lend_emi');
          setPandaBubble(
            `Ooh! I spotted ${detectedMembers} tickets/members on that receipt! Tell me their names and who paid so I can auto-update Lend & Borrow! 🎟️🐼`
          );
        } else {
          setScanSummary(`✅ ${parsed.reason || 'Receipt details auto-filled!'} Toggle "Split with Friends" below if shared.`);
        }
      } catch (_) {
        setScanSummary('📸 Receipt attached! Enter the amount & toggle "Split with Friends" if shared with others.');
      } finally {
        setIsScanningReceipt(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper to create Lend or Borrow record directly
  const createLendBorrowRecord = async ({ direction, person, amount, purpose, dueDate, phone = '' }) => {
    const entry = {
      direction, // 'lent' | 'borrowed'
      person: person.trim(),
      amount: Math.round(Number(amount) * 100) / 100,
      purpose: purpose.trim(),
      dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      phone: phone.trim(),
      status: 'Pending',
      createdAt: Date.now()
    };

    if (!isFirebaseConfigured || !db || user.isLocalFallback) {
      setLendEntries((prev) => {
        const next = [{ id: `lb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...entry }, ...prev];
        syncLocalState(user.uid, 'lend', next);
        return next;
      });
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'lend_borrow'), entry);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    const numericAmount = parseFloat(txAmount);
    if (!numericAmount || numericAmount <= 0 || isSubmitting) {
      triggerToast('Please enter a valid amount greater than ₹0');
      return;
    }

    const validList = txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const safeCategory = validList.some((c) => c.id === txCategory) ? txCategory : validList[0].id;
    const catLabel = ALL_CATEGORIES_MAP[safeCategory]?.label || safeCategory;

    setIsSubmitting(true);
    try {
      // Multi-Person Ticket / Bill Split Logic (Expense only)
      if (txType === 'expense' && isSplitEnabled && splitCount >= 2) {
        const friendNames = splitMembers.map((n, idx) => n.trim() || `Friend ${idx + 1}`);
        const perPersonShare = Math.round((numericAmount / splitCount) * 100) / 100;
        const baseDesc = txNote.trim() || catLabel;

        if (splitPaidBy === 'me') {
          // 1. Log user's own share as their personal expense
          await createTransactionEntry({
            type: 'expense',
            category: safeCategory,
            amount: perPersonShare,
            note: `${baseDesc} (My 1/${splitCount} share of ₹${numericAmount})`,
            date: txDate,
            paymentMethod: txPaymentMethod,
            utr: txUtr
          });

          // 2. Automatically add each friend's share into "LEND" ("I lent money") AND count outflow in expenses!
          for (const friend of friendNames) {
            await createLendBorrowRecord({
              direction: 'lent',
              person: friend,
              amount: perPersonShare,
              purpose: `${baseDesc} (Split 1/${splitCount})`
            });
            await createTransactionEntry({
              type: 'expense',
              category: 'lend_emi',
              amount: perPersonShare,
              note: `Lent to ${friend} for ${baseDesc}`,
              date: txDate,
              paymentMethod: txPaymentMethod,
              skipPanda: true
            });
          }

          await recordAudit(
            `Split "${baseDesc}" (${formatCurrency(numericAmount)}) across ${splitCount} people — Lent ${formatCurrency(
              perPersonShare
            )} each to ${friendNames.join(', ')}`
          );
          triggerToast(`Split saved! Added ${friendNames.join(' & ')} to Lend (${formatCurrency(perPersonShare)} each)!`);
        } else {
          // A friend paid the whole bill -> User owes that friend their 1/N share!
          const payerIdx = Number(splitPaidBy) || 0;
          const payerName = friendNames[payerIdx] || 'Friend 1';

          // 1. Log user's share as their Expense
          await createTransactionEntry({
            type: 'expense',
            category: safeCategory,
            amount: perPersonShare,
            note: `${baseDesc} (Paid by ${payerName}, my 1/${splitCount} share)`,
            date: txDate,
            paymentMethod: txPaymentMethod,
            utr: txUtr
          });

          // 2. Automatically add user's share into "BORROW" ("I borrowed money")
          await createLendBorrowRecord({
            direction: 'borrowed',
            person: payerName,
            amount: perPersonShare,
            purpose: `${baseDesc} (Split 1/${splitCount} — ${payerName} paid)`
          });

          await recordAudit(
            `Split "${baseDesc}" paid by ${payerName} — Added ${formatCurrency(perPersonShare)} to Borrow`
          );
          triggerToast(`Saved! Added ₹${perPersonShare} owed to ${payerName} in Borrow!`);
        }
      } else {
        // Standard single-person transaction
        await createTransactionEntry({
          type: txType,
          category: safeCategory,
          amount: numericAmount,
          note: txNote,
          date: txDate,
          paymentMethod: txPaymentMethod,
          utr: txUtr
        });
        await recordAudit(`Added ${txType}: ${catLabel} (${formatCurrency(numericAmount)})`);
        triggerToast(`${txType === 'income' ? 'Income' : 'Expense'} saved!`);
      }

      // Reset form & scanner state
      setTxAmount('');
      setTxNote('');
      setTxUtr('');
      setReceiptPreview('');
      setScanSummary('');
      setIsSplitEnabled(false);
      setSplitCount(2);
      setSplitMembers(['']);
      setSplitPaidBy('me');
      setActiveTab('dashboard');
    } catch (_) {
      triggerToast('Could not save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV File Parser & Bulk Importer
  const handleCsvFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = String(reader.result)
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length < 2) {
          setCsvError('CSV file is empty or missing data rows.');
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const dateIdx = headers.indexOf('date');
        const descIdx = headers.indexOf('description');
        const amtIdx = headers.indexOf('amount');
        const typeIdx = headers.indexOf('type');
        const catIdx = headers.indexOf('category');
        const refIdx = headers.indexOf('reference');
        const methodIdx = headers.indexOf('payment_method');

        if (dateIdx === -1 || descIdx === -1 || amtIdx === -1 || typeIdx === -1) {
          setCsvError('Required CSV headers: date, description, amount, type');
          return;
        }

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          const rawType = (cols[typeIdx] || '').toLowerCase();
          const normType = rawType === 'income' ? 'income' : rawType === 'expense' ? 'expense' : null;
          const amt = Math.abs(parseFloat(cols[amtIdx]));
          if (!normType || !amt || isNaN(amt)) continue;

          const rawCat = (cols[catIdx] || '').toLowerCase();
          const matchedCat =
            Object.values(ALL_CATEGORIES_MAP).find(
              (c) => c.id === rawCat || c.label.toLowerCase().includes(rawCat)
            )?.id || (normType === 'income' ? 'other_income' : 'other_expense');

          parsed.push({
            date: cols[dateIdx] || new Date().toISOString().split('T')[0],
            description: cols[descIdx] || 'Imported transaction',
            amount: amt,
            type: normType,
            category: matchedCat,
            reference: refIdx !== -1 ? cols[refIdx] || '' : '',
            paymentMethod: methodIdx !== -1 ? cols[methodIdx] || 'UPI' : 'UPI'
          });
        }

        if (parsed.length === 0) {
          setCsvError('No valid Income/Expense rows found in CSV.');
        } else {
          setCsvPreviewRows(parsed);
        }
      } catch (_) {
        setCsvError('Could not parse CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = async () => {
    if (csvPreviewRows.length === 0) return;
    setIsSubmitting(true);
    try {
      for (const row of csvPreviewRows) {
        await createTransactionEntry({
          type: row.type,
          category: row.category,
          amount: row.amount,
          note: row.description,
          date: row.date,
          paymentMethod: row.paymentMethod,
          utr: row.reference,
          skipPanda: true
        });
      }
      await recordAudit(`Imported ${csvPreviewRows.length} transactions via CSV`);
      triggerToast(`Successfully imported ${csvPreviewRows.length} transactions!`);
      setCsvPreviewRows([]);
      setIsCsvModalOpen(false);
    } catch (_) {
      triggerToast('CSV import encountered an error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group Quick Bill-Splitter Handler
  const handleGroupBillSplit = async (e) => {
    e.preventDefault();
    const total = parseFloat(billTotal);
    if (!billTitle.trim() || !total || total <= 0) {
      triggerToast('Enter bill title and total amount');
      return;
    }
    const friends = billFriendNames.map((n, i) => n.trim() || `Friend ${i + 1}`);
    const share = Math.round((total / billPeopleCount) * 100) / 100;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      if (billPayer === 'me') {
        await createTransactionEntry({
          type: 'expense',
          category: billCategory,
          amount: share,
          note: `${billTitle.trim()} (My 1/${billPeopleCount} share)`,
          date: todayStr
        });
        for (const f of friends) {
          await createLendBorrowRecord({
            direction: 'lent',
            person: f,
            amount: share,
            purpose: `${billTitle.trim()} (Split 1/${billPeopleCount})`
          });
          await createTransactionEntry({
            type: 'expense',
            category: 'lend_emi',
            amount: share,
            note: `Lent to ${f} for ${billTitle.trim()}`,
            date: todayStr,
            skipPanda: true
          });
        }
        triggerToast(`Split ₹${total}! Added ${friends.join(', ')} to Lend (₹${share} each)!`);
      } else {
        const payerName = friends[Number(billPayer) || 0] || 'Friend 1';
        await createTransactionEntry({
          type: 'expense',
          category: billCategory,
          amount: share,
          note: `${billTitle.trim()} (Paid by ${payerName})`,
          date: todayStr
        });
        await createLendBorrowRecord({
          direction: 'borrowed',
          person: payerName,
          amount: share,
          purpose: `${billTitle.trim()} (Split 1/${billPeopleCount})`
        });
        triggerToast(`Saved! Added ₹${share} borrowed from ${payerName}!`);
      }

      setBillTitle('');
      setBillTotal('');
      setActiveTab('lend_loans');
    } catch (_) {
      triggerToast('Could not split bill');
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const updated = transactions.filter((t) => t.id !== id);
        setTransactions(updated);
        syncLocalState(user.uid, 'tx', updated);
      } else {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
      }
      triggerToast('Transaction deleted');
    } catch (_) {}
  };

  // Create Group Fund
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const target = parseFloat(newGroupTarget);
    if (!newGroupName.trim() || !target || target <= 0) {
      triggerToast('Enter group name and target amount');
      return;
    }
    const inviteCode = `FIN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const groupObj = {
      name: newGroupName.trim(),
      targetAmount: target,
      description: newGroupDesc.trim(),
      inviteCode,
      creatorId: user.uid,
      creatorName: user.displayName || user.email?.split('@')[0] || 'Creator',
      memberIds: [user.uid],
      contributions: [],
      createdAt: Date.now()
    };

    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const next = [{ id: inviteCode, ...groupObj }, ...groupFunds];
        setGroupFunds(next);
        syncLocalState(user.uid, 'groups', next);
      } else {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'group_funds', inviteCode), groupObj);
      }
      await recordAudit(`Created Group Fund "${groupObj.name}" (${inviteCode})`);
      setNewGroupName('');
      setNewGroupTarget('');
      setNewGroupDesc('');
      setGroupSubTab('my_groups');
      triggerToast(`Group created! Code: ${inviteCode}`);
    } catch (_) {
      triggerToast('Failed to create group fund');
    }
  };

  // Join Existing Group by Code
  const handleJoinGroup = async (e) => {
    e.preventDefault();
    const code = joinGroupCode.trim().toUpperCase();
    if (!code) return;

    if (!isFirebaseConfigured || !db || user.isLocalFallback) {
      triggerToast('Group invite codes sync live when connected to Firebase Cloud!');
      return;
    }

    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'group_funds', code);
      await updateDoc(ref, {
        memberIds: Array.from(new Set([...(groupFunds.find((g) => g.id === code)?.memberIds || []), user.uid]))
      });
      setJoinGroupCode('');
      setGroupSubTab('my_groups');
      triggerToast(`Joined group ${code}!`);
    } catch (_) {
      triggerToast('Group code not found. Double-check the ID.');
    }
  };

  // Contribute to Group Fund -> ALSO COUNTS AS AN EXPENSE IN TRANSACTIONS!
  const handleGroupContribute = async (e) => {
    e.preventDefault();
    const amt = parseFloat(contribAmount);
    const targetGroup = groupFunds.find((g) => g.id === contribGroupId) || groupFunds[0];
    if (!targetGroup || !amt || amt <= 0) {
      triggerToast('Select a group and enter a valid amount');
      return;
    }

    const contribEntry = {
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || 'Member',
      amount: amt,
      note: contribNote.trim(),
      createdAt: Date.now()
    };

    const nextContribs = [...(targetGroup.contributions || []), contribEntry];

    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const updatedGroups = groupFunds.map((g) =>
          g.id === targetGroup.id ? { ...g, contributions: nextContribs } : g
        );
        setGroupFunds(updatedGroups);
        syncLocalState(user.uid, 'groups', updatedGroups);
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'group_funds', targetGroup.id), {
          contributions: nextContribs
        });
      }

      // Automatically record in user's Expenses so it counts in totals & charts!
      await createTransactionEntry({
        type: 'expense',
        category: 'savings_alloc',
        amount: amt,
        note: `Group Fund: ${targetGroup.name}${contribNote ? ` (${contribNote})` : ''}`,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'UPI'
      });

      await recordAudit(`Contributed ${formatCurrency(amt)} to Group "${targetGroup.name}"`);
      setContribAmount('');
      setContribNote('');
      triggerToast(`Contributed ${formatCurrency(amt)} & logged in expenses!`);
    } catch (_) {
      triggerToast('Could not record contribution');
    }
  };

  // Add Lend or Borrow Entry -> "I lent money" counts in Expenses!
  const handleAddLendBorrow = async (e) => {
    e.preventDefault();
    const amt = parseFloat(lendAmount);
    if (!lendPerson.trim() || !amt || amt <= 0) {
      triggerToast('Enter person name and valid amount');
      return;
    }

    const entry = {
      direction: lendDirection, // 'lent' | 'borrowed'
      person: lendPerson.trim(),
      amount: amt,
      purpose: lendPurpose.trim(),
      dueDate: lendDueDate,
      phone: lendPhone.trim(),
      status: 'Pending',
      createdAt: Date.now()
    };

    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const next = [{ id: `lb_${Date.now()}`, ...entry }, ...lendEntries];
        setLendEntries(next);
        syncLocalState(user.uid, 'lend', next);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'lend_borrow'), entry);
      }

      if (lendDirection === 'lent') {
        await createTransactionEntry({
          type: 'expense',
          category: 'lend_emi',
          amount: amt,
          note: `Lent to ${entry.person}${entry.purpose ? `: ${entry.purpose}` : ''}`,
          date: new Date().toISOString().split('T')[0]
        });
      }

      await recordAudit(
        `${lendDirection === 'lent' ? 'Lent' : 'Borrowed'} ${formatCurrency(amt)} (${entry.person})`
      );
      setLendPerson('');
      setLendAmount('');
      setLendPurpose('');
      setLendPhone('');
      triggerToast(
        lendDirection === 'lent'
          ? `Lent ${formatCurrency(amt)} & added to expenses!`
          : `Recorded ${formatCurrency(amt)} borrowed!`
      );
    } catch (_) {
      triggerToast('Failed to save lend/borrow entry');
    }
  };

  // Settle Lend/Borrow Entry
  const handleSettleLendBorrow = async (item) => {
    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const next = lendEntries.map((x) => (x.id === item.id ? { ...x, status: 'Returned' } : x));
        setLendEntries(next);
        syncLocalState(user.uid, 'lend', next);
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lend_borrow', item.id), {
          status: 'Returned'
        });
      }

      // If you lent money and they paid you back -> log Refund income; if you repaid borrowed money -> log Expense!
      if (item.direction === 'lent') {
        await createTransactionEntry({
          type: 'income',
          category: 'refund',
          amount: Number(item.amount),
          note: `Repaid by ${item.person}`,
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        await createTransactionEntry({
          type: 'expense',
          category: 'lend_emi',
          amount: Number(item.amount),
          note: `Repaid loan to ${item.person}`,
          date: new Date().toISOString().split('T')[0]
        });
      }

      await recordAudit(`Settled ${item.direction} with ${item.person} (${formatCurrency(item.amount)})`);
      triggerToast('Marked as Returned & updated cashflow!');
    } catch (_) {}
  };

  // Add Loan
  const handleAddLoan = async (e) => {
    e.preventDefault();
    const principal = parseFloat(loanPrincipal);
    const emi = parseFloat(loanEmi);
    const months = parseInt(loanMonths, 10) || 12;
    if (!loanName.trim() || !principal || !emi) {
      triggerToast('Enter loan name, principal, and monthly EMI');
      return;
    }

    const loanObj = {
      name: loanName.trim(),
      principal,
      emi,
      rate: parseFloat(loanRate) || 0,
      remainingMonths: months,
      nextDue: loanNextDue,
      createdAt: Date.now()
    };

    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const next = [{ id: `loan_${Date.now()}`, ...loanObj }, ...loans];
        setLoans(next);
        syncLocalState(user.uid, 'loans', next);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), loanObj);
      }
      await recordAudit(`Added Loan "${loanObj.name}" (EMI: ${formatCurrency(emi)}/mo)`);
      setLoanName('');
      setLoanPrincipal('');
      setLoanEmi('');
      setLoanRate('');
      setLoanMonths('');
      triggerToast('Loan added to EMI planner!');
    } catch (_) {}
  };

  // Mark EMI Paid -> COUNTS AS EXPENSE & REDUCES REMAINING MONTHS!
  const handlePayEmi = async (loan) => {
    const emiAmt = Number(loan.emi) || 0;
    const nextMonths = Math.max(0, (Number(loan.remainingMonths) || 1) - 1);
    const nextPrincipal = Math.max(0, (Number(loan.principal) || 0) - emiAmt);

    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const next = loans.map((l) =>
          l.id === loan.id ? { ...l, remainingMonths: nextMonths, principal: nextPrincipal } : l
        );
        setLoans(next);
        syncLocalState(user.uid, 'loans', next);
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', loan.id), {
          remainingMonths: nextMonths,
          principal: nextPrincipal
        });
      }

      await createTransactionEntry({
        type: 'expense',
        category: 'lend_emi',
        amount: emiAmt,
        note: `EMI Paid: ${loan.name}`,
        date: new Date().toISOString().split('T')[0]
      });

      await recordAudit(`Paid EMI for "${loan.name}" (${formatCurrency(emiAmt)})`);
      triggerToast(`EMI of ${formatCurrency(emiAmt)} paid & counted in expenses!`);
    } catch (_) {}
  };

  // Add Savings Goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    const target = parseFloat(goalTarget);
    if (!goalName.trim() || !target || target <= 0) return;

    const goalObj = {
      name: goalName.trim(),
      target,
      saved: 0,
      createdAt: Date.now()
    };

    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const next = [{ id: `goal_${Date.now()}`, ...goalObj }, ...savingsGoals];
        setSavingsGoals(next);
        syncLocalState(user.uid, 'goals', next);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'savings_goals'), goalObj);
      }
      setGoalName('');
      setGoalTarget('');
      triggerToast('Savings goal created!');
    } catch (_) {}
  };

  const handleAddToGoal = async (goal) => {
    const addAmt = parseFloat(goalAddMap[goal.id]);
    if (!addAmt || addAmt <= 0) return;
    const nextSaved = (Number(goal.saved) || 0) + addAmt;

    try {
      if (!isFirebaseConfigured || !db || user.isLocalFallback) {
        const next = savingsGoals.map((g) => (g.id === goal.id ? { ...g, saved: nextSaved } : g));
        setSavingsGoals(next);
        syncLocalState(user.uid, 'goals', next);
      } else {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'savings_goals', goal.id), {
          saved: nextSaved
        });
      }

      await createTransactionEntry({
        type: 'expense',
        category: 'savings_alloc',
        amount: addAmt,
        note: `Savings Goal: ${goal.name}`,
        date: new Date().toISOString().split('T')[0]
      });

      setGoalAddMap((prev) => ({ ...prev, [goal.id]: '' }));
      triggerToast(`Saved ${formatCurrency(addAmt)} toward ${goal.name}!`);
    } catch (_) {}
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        triggerToast('Finora installed on your device!');
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth && !user?.isLocalFallback) {
      await signOut(auth);
    }
    setUser(null);
    setTransactions([]);
  };

  // Filtered Transactions for History
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (txFilterType !== 'all' && t.type !== txFilterType) return false;
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase();
        const catLabel = (ALL_CATEGORIES_MAP[t.category]?.label || t.category).toLowerCase();
        const note = (t.note || '').toLowerCase();
        return catLabel.includes(q) || note.includes(q);
      }
      return true;
    });
  }, [transactions, txFilterType, txSearch]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#090D16] flex flex-col items-center justify-center text-white">
        <FinoraLogo size={54} />
        <p className="mt-4 text-sm text-cyan-300 animate-pulse">Syncing Finora Cloud...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLocalLogin={(localUser) => setUser(localUser)} />;
  }

  const activeCategoryList = txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const activeTheme = THEME_PACKS[activeThemeName] || THEME_PACKS['Midnight Luxe'];

  return (
    <div
      style={{
        backgroundColor: activeTheme.bg,
        color: activeTheme.text,
        '--finora-accent': activeTheme.accent,
        '--finora-accent2': activeTheme.accent2
      }}
      className="min-h-screen pb-28 md:pb-10 md:pl-64 font-sans selection:bg-cyan-500/30 transition-colors duration-300"
    >
      <style>{`
        @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes floatBot { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
        @keyframes vroom { 0%, 100% { transform: translateX(0px) rotate(0deg); } 25% { transform: translateX(3px) rotate(2deg); } 75% { transform: translateX(-3px) rotate(-2deg); } }
        @keyframes celebrate { 0%, 100% { transform: translateY(0px) scale(1); } 40% { transform: translateY(-8px) scale(1.07); } }
        @keyframes bellyRub { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08, 0.94); } }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 30% { transform: scale(1.1); } 60% { transform: scale(0.98); } }
        @keyframes sadShake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
        @keyframes bounceSoft { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        .animate-spin-slow { animation: spinSlow 9s linear infinite; }
        .animate-float { animation: floatBot 3.2s ease-in-out infinite; }
        .animate-vroom { animation: vroom 0.65s ease-in-out infinite; }
        .animate-celebrate { animation: celebrate 0.9s ease-in-out infinite; }
        .animate-belly-rub { animation: bellyRub 1.4s ease-in-out infinite; }
        .animate-heartbeat { animation: heartbeat 1.1s ease-in-out infinite; }
        .animate-sad-shake { animation: sadShake 1.2s ease-in-out infinite; }
        .animate-bounce-soft { animation: bounceSoft 1.3s ease-in-out infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ====================================================================
          TOP GLASSMORPHIC FINORA NAVBAR
         ==================================================================== */}
      <header className="sticky top-0 z-30 bg-[#090D16]/85 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FinoraLogo size={34} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">Finora</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {syncStatus === 'synced' ? <Cloud className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
                {syncStatus === 'synced' ? 'Synced' : 'Active'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[155px] sm:max-w-xs">
              {user.displayName || user.email?.split('@')[0] || 'Friend'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setInsightSubTab('settings');
              setActiveTab('insights');
            }}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-cyan-300 transition active:scale-95"
            title="Switch Theme Pack"
          >
            <Palette className="w-4 h-4" />
          </button>

          <button
            onClick={handleInstallPWA}
            className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition active:scale-95"
            title="Install Finora App on your phone"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install App</span>
            <span className="sm:hidden">App</span>
          </button>

          <button
            onClick={() => setIsShareOpen(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-cyan-500/40 text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95"
            title="Share chart snapshot with friends"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          DESKTOP SIDEBAR NAVIGATION
         ==================================================================== */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 bg-[#0B101D] border-r border-slate-800/80 flex-col justify-between p-5 z-30">
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-slate-800/80">
            <FinoraLogo size={38} />
            <div>
              <h2 className="font-extrabold text-lg text-white leading-none">Finora</h2>
              <span className="text-[11px] text-cyan-400 font-medium">AI Expense & Social Wealth</span>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Wallet },
              { id: 'transactions', label: 'Transactions', icon: Plus },
              { id: 'groups', label: 'Group Funding', icon: Users },
              { id: 'lend_loans', label: 'Lend, Borrow & Loans', icon: HandCoins },
              { id: 'insights', label: 'Charts, Goals & Profile', icon: PieChart }
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-cyan-300' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setIsCoachOpen(true)}
            className="w-full p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/30 text-left hover:border-cyan-400 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                🐼 {pandaName} Coach
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Tap for AI money advice</p>
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ====================================================================
          MAIN CONTENT AREA
         ==================================================================== */}
      <main className="max-w-3xl mx-auto px-4 pt-5 space-y-5">
        {/* ==================== TAB 1: DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <>
            {/* Hero Balance & Cashflow Card */}
            <section className="rounded-3xl bg-gradient-to-br from-[#121C2E] via-[#0F172A] to-[#0B2228] border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Cashflow Balance</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Savings Rate: {stats.savingsRate}%
                </span>
              </div>

              <div className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {formatCurrency(stats.balance)}
              </div>

              {/* 4-Card KPI Strip (Income, All-Inclusive Expenses, Friends Owe You, Monthly EMIs) */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">Total Income</p>
                    <p className="text-sm sm:text-base font-bold text-emerald-400 truncate">
                      {formatCurrency(stats.totalIncome)}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/90 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">All Expenses</p>
                    <p className="text-sm sm:text-base font-bold text-rose-400 truncate">
                      {formatCurrency(stats.totalExpense)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('lend_loans')}
                  className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-left hover:border-amber-500/40 transition"
                >
                  <p className="text-[11px] text-slate-400">Friends Owe You</p>
                  <p className="text-sm font-bold text-amber-300 mt-0.5">{formatCurrency(lendSummary.toReceive)}</p>
                </button>

                <button
                  onClick={() => {
                    setSocialSubTab('loans');
                    setActiveTab('lend_loans');
                  }}
                  className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 text-left hover:border-cyan-500/40 transition"
                >
                  <p className="text-[11px] text-slate-400">Active Monthly EMIs</p>
                  <p className="text-sm font-bold text-cyan-300 mt-0.5">{formatCurrency(loanSummary.monthlyEmi)}</p>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    handleSwitchTxType('expense');
                    setActiveTab('transactions');
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" /> Log Expense
                </button>
                <button
                  onClick={() => {
                    handleSwitchTxType('income');
                    setActiveTab('transactions');
                  }}
                  className="py-2.5 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" /> Log Income
                </button>
              </div>
            </section>

            {/* Budget Pulse Progress Gauge */}
            <section className="rounded-3xl bg-[#111827] border border-slate-800/90 p-5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  Budget Pulse (Includes Group, Lent & EMIs)
                </span>
                <span className="font-bold text-cyan-300">
                  {formatCurrency(stats.totalExpense)} / {formatCurrency(monthlyBudget)} ({stats.budgetUsedPct}%)
                </span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-slate-900 overflow-hidden p-0.5">
                <div
                  style={{ width: `${Math.min(100, stats.budgetUsedPct)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.budgetUsedPct >= 100
                      ? 'bg-gradient-to-r from-rose-600 to-red-500'
                      : stats.budgetUsedPct >= 80
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                      : 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                  }`}
                />
              </div>
              {stats.budgetUsedPct >= 80 && (
                <p className={`mt-2 text-[11px] font-medium flex items-center gap-1.5 ${stats.budgetUsedPct >= 100 ? 'text-rose-400' : 'text-amber-300'}`}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {stats.budgetUsedPct >= 100
                    ? 'Budget limit exceeded! Review non-essential spending.'
                    : 'Approaching 80% of your monthly budget limit.'}
                </p>
              )}
            </section>

            {/* Interactive Dashboard Visual Charts Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Interactive Spending Breakdown Donut Chart */}
              <div className="rounded-3xl bg-[#111827] border border-slate-800/90 p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-sm text-white">Spending Breakdown</h3>
                    <p className="text-[11px] text-slate-400">Tap a slice to inspect category</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('insights')}
                    className="text-[11px] text-cyan-400 font-semibold hover:underline"
                  >
                    Full Charts
                  </button>
                </div>

                {stats.categoryBreakdown.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Log an expense to see your live spending donut chart
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="44" fill="none" stroke="#1E293B" strokeWidth="16" />
                        {(() => {
                          const circumference = 2 * Math.PI * 44;
                          let offset = 0;
                          return stats.categoryBreakdown.map((cat) => {
                            const dash = (cat.percentage / 100) * circumference;
                            const el = (
                              <circle
                                key={cat.id}
                                cx="60"
                                cy="60"
                                r="44"
                                fill="none"
                                stroke={cat.color}
                                strokeWidth="16"
                                strokeDasharray={`${dash} ${circumference}`}
                                strokeDashoffset={-offset}
                                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                              >
                                <title>{`${cat.label}: ${formatCurrency(cat.amount)} (${cat.percentage}%)`}</title>
                              </circle>
                            );
                            offset += dash;
                            return el;
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Total Out</span>
                        <span className="text-xs font-extrabold text-white mt-0.5 truncate max-w-[78px]">
                          {formatCurrency(stats.totalExpense)}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {stats.categoryBreakdown.slice(0, 4).map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between text-xs gap-2">
                          <span className="flex items-center gap-1.5 text-slate-300 truncate">
                            <span style={{ backgroundColor: cat.color }} className="w-2.5 h-2.5 rounded-full shrink-0" />
                            <span className="truncate">{cat.label}</span>
                          </span>
                          <span className="font-bold text-slate-200 shrink-0">{cat.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Income vs Expenses Animated Comparison Bar Chart */}
              <div className="rounded-3xl bg-[#111827] border border-slate-800/90 p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-sm text-white">Income vs. Expenses</h3>
                    <p className="text-[11px] text-slate-400">Cashflow comparison</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      stats.balance >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {stats.balance >= 0 ? `+${formatCurrency(stats.balance)}` : formatCurrency(stats.balance)}
                  </span>
                </div>

                {(() => {
                  const maxVal = Math.max(stats.totalIncome, stats.totalExpense, 1);
                  const incHeight = Math.max(8, Math.round((stats.totalIncome / maxVal) * 100));
                  const expHeight = Math.max(8, Math.round((stats.totalExpense / maxVal) * 100));
                  const netSavings = Math.max(0, stats.totalIncome - stats.totalExpense);
                  const savHeight = Math.max(6, Math.round((netSavings / maxVal) * 100));

                  return (
                    <div className="h-36 flex items-end justify-around gap-4 pt-4 px-2 border-b border-slate-800/80">
                      <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[10px] font-bold text-emerald-400">{formatCurrency(stats.totalIncome)}</span>
                        <div
                          style={{ height: `${incHeight}%` }}
                          className="w-full max-w-[44px] rounded-t-xl bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500 shadow-lg shadow-emerald-500/20"
                        />
                        <span className="text-[11px] font-semibold text-slate-400 pb-1">Income</span>
                      </div>

                      <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[10px] font-bold text-rose-400">{formatCurrency(stats.totalExpense)}</span>
                        <div
                          style={{ height: `${expHeight}%` }}
                          className="w-full max-w-[44px] rounded-t-xl bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-500 shadow-lg shadow-rose-500/20"
                        />
                        <span className="text-[11px] font-semibold text-slate-400 pb-1">Expenses</span>
                      </div>

                      <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[10px] font-bold text-cyan-400">{formatCurrency(netSavings)}</span>
                        <div
                          style={{ height: `${savHeight}%` }}
                          className="w-full max-w-[44px] rounded-t-xl bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-500 shadow-lg shadow-cyan-500/20"
                        />
                        <span className="text-[11px] font-semibold text-slate-400 pb-1">Saved</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* 3. 7-Day Spending Rhythm Sparkline Area Chart */}
            <section className="rounded-3xl bg-[#111827] border border-slate-800/90 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-white">7-Day Spending Rhythm</h3>
                  <p className="text-[11px] text-slate-400">Daily outflow velocity across the past week</p>
                </div>
                <span className="text-[11px] text-slate-400">
                  Daily Target: <strong className="text-cyan-300">{formatCurrency(Math.round(monthlyBudget / 30))}</strong>
                </span>
              </div>

              {(() => {
                const days = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(Date.now() - (6 - i) * 86400000);
                  const iso = d.toISOString().split('T')[0];
                  const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
                  const total = transactions
                    .filter((t) => t.type === 'expense' && t.date === iso)
                    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                  return { iso, label, total };
                });

                const maxDay = Math.max(...days.map((d) => d.total), Math.round(monthlyBudget / 30), 100);
                const width = 320;
                const height = 84;
                const padX = 16;
                const padY = 12;
                const points = days.map((d, idx) => {
                  const x = padX + (idx / 6) * (width - padX * 2);
                  const y = height - padY - (d.total / maxDay) * (height - padY * 2);
                  return { x, y, ...d };
                });
                const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

                return (
                  <div>
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
                      <defs>
                        <linearGradient id="rhythmFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d={areaPath} fill="url(#rhythmFill)" />
                      <path d={linePath} fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((p) => (
                        <g key={p.iso}>
                          <circle cx={p.x} cy={p.y} r="3.8" fill="#090D16" stroke="#10B981" strokeWidth="2.2">
                            <title>{`${p.label} (${p.iso}): ${formatCurrency(p.total)}`}</title>
                          </circle>
                        </g>
                      ))}
                    </svg>
                    <div className="flex justify-between px-1 mt-1">
                      {days.map((d) => (
                        <div key={d.iso} className="text-center">
                          <span className="block text-[10px] font-semibold text-slate-400">{d.label}</span>
                          <span className="block text-[9px] text-slate-500">
                            {d.total > 0 ? `₹${d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : d.total}` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* Recent Activity List */}
            <section className="rounded-3xl bg-[#111827] border border-slate-800/90 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-white">Recent Activity</h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs text-cyan-400 font-semibold hover:underline"
                >
                  View All ({transactions.length})
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-2xl mb-3">
                    🐼
                  </div>
                  <p className="text-sm font-semibold text-slate-200">No transactions yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Tap <span className="text-cyan-400 font-semibold">+</span> below to log your first expense or income!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {transactions.slice(0, 6).map((tx) => {
                    const cat = ALL_CATEGORIES_MAP[tx.category] || { label: tx.category, icon: Coins, color: '#94A3B8' };
                    const Icon = cat.icon;
                    const isInc = tx.type === 'income';
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{cat.label}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {tx.note || tx.date} • {tx.paymentMethod || 'UPI'}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-extrabold shrink-0 ${isInc ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isInc ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* ==================== TAB 2: TRANSACTIONS (ADD + AI SCANNER + SPLIT + CSV) ==================== */}
        {activeTab === 'transactions' && (
          <div className="space-y-5">
            <section className="rounded-3xl bg-[#111827] border border-slate-800 p-5 sm:p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Add Transaction</h2>
                  <p className="text-xs text-slate-400">
                    Scan a movie ticket/receipt or log manually — {pandaName} reacts to every activity!
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* CSV Import Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsCsvModalOpen(true)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> CSV
                  </button>

                  {/* AI Receipt & Ticket Scanner Trigger */}
                  <label className="cursor-pointer px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 border border-cyan-400/50 text-xs font-bold text-cyan-200 flex items-center gap-1.5 transition active:scale-95">
                    <ScanLine className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{isScanningReceipt ? 'Scanning...' : 'Scan Ticket / Bill'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* AI Ticket / Receipt Scan Status Banner */}
              {(isScanningReceipt || scanSummary || receiptPreview) && (
                <div className="mb-4 p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/35 flex items-center gap-3">
                  {receiptPreview && (
                    <img
                      src={receiptPreview}
                      alt="Uploaded ticket or receipt"
                      className="w-12 h-12 rounded-xl object-cover border border-cyan-400/40 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-cyan-200">
                      {isScanningReceipt
                        ? '🔍 AI is reading your ticket/receipt for amount, venue & member count...'
                        : scanSummary}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptPreview('');
                      setScanSummary('');
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Expense vs Income Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => handleSwitchTxType('expense')}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${
                    txType === 'expense'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTxType('income')}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${
                    txType === 'income'
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Income
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                {/* Zero-Friction Amount Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Amount (₹)</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-xl font-bold text-cyan-400">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0.01"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      placeholder="Type amount (e.g. 200)"
                      required
                      className="w-full pl-10 pr-12 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-2xl font-extrabold text-white placeholder-slate-600 focus:outline-none"
                    />
                    {txAmount && (
                      <button
                        type="button"
                        onClick={() => setTxAmount('')}
                        className="absolute right-3.5 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Strict Category Grid */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    {txType === 'expense' ? 'Expense Category' : 'Income Source'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeCategoryList.map((cat) => {
                      const Icon = cat.icon;
                      const selected = txCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setTxCategory(cat.id)}
                          className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition active:scale-97 ${
                            selected
                              ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md'
                              : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div
                            style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[11px] font-bold leading-tight">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Description, Date, Payment Method & UTR */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Note</label>
                    <input
                      type="text"
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                      placeholder={txType === 'expense' ? 'e.g. Movie Tickets (3 seats)' : 'e.g. Monthly Allowance'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Mode</label>
                    <select
                      value={txPaymentMethod}
                      onChange={(e) => setTxPaymentMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>{pm}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">UTR / Booking ID (Optional)</label>
                    <input
                      type="text"
                      value={txUtr}
                      onChange={(e) => setTxUtr(e.target.value)}
                      placeholder="e.g. BMS-982341"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* ============================================================
                    MULTI-MEMBER TICKET / EXPENSE SPLITTER (AUTO LEND & BORROW)
                   ============================================================ */}
                {txType === 'expense' && (
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-amber-400" />
                        <div>
                          <p className="text-xs font-bold text-white">Split Ticket / Bill with Friends</p>
                          <p className="text-[11px] text-slate-400">
                            Auto-adds to Lend (if you paid) or Borrow (if a friend paid)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSplitEnabled(!isSplitEnabled)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          isSplitEnabled
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {isSplitEnabled ? 'Splitting ON' : '+ Split'}
                      </button>
                    </div>

                    {isSplitEnabled && (
                      <div className="pt-3 border-t border-slate-800/90 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-semibold text-slate-300">
                            Total Members (including You):
                          </label>
                          <div className="flex items-center gap-1.5">
                            {[2, 3, 4, 5, 6].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => updateTotalSplitPeople(num)}
                                className={`w-8 h-8 rounded-lg text-xs font-extrabold transition ${
                                  splitCount === num
                                    ? 'bg-cyan-500 text-slate-950'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Friend Names Inputs */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-slate-400">
                            Enter the other {splitCount - 1} member(s)' names:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {splitMembers.map((memberName, idx) => (
                              <input
                                key={idx}
                                type="text"
                                value={memberName}
                                onChange={(e) => {
                                  const next = [...splitMembers];
                                  next[idx] = e.target.value;
                                  setSplitMembers(next);
                                }}
                                placeholder={`Friend ${idx + 1} name`}
                                required
                                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                              />
                            ))}
                          </div>
                        </div>

                        {/* Who Paid Selector */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                            Who paid from their pocket?
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSplitPaidBy('me')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                                splitPaidBy === 'me'
                                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                  : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                            >
                              I Paid (Friends owe me)
                            </button>
                            {splitMembers.map((mName, idx) => {
                              const displayFriend = mName.trim() || `Friend ${idx + 1}`;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSplitPaidBy(String(idx))}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                                    splitPaidBy === String(idx)
                                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                                      : 'bg-slate-900 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {displayFriend} Paid (I owe share)
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Live Per-Person Calculation Preview */}
                        {parseFloat(txAmount) > 0 && (
                          <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs space-y-1">
                            <div className="flex justify-between font-bold text-cyan-300">
                              <span>Per-Person Share (1/{splitCount}):</span>
                              <span>{formatCurrency(parseFloat(txAmount) / splitCount)}</span>
                            </div>
                            {splitPaidBy === 'me' ? (
                              <p className="text-[11px] text-emerald-300">
                                ✓ Your share ({formatCurrency(parseFloat(txAmount) / splitCount)}) logs as Expense, and{' '}
                                <strong>
                                  {splitMembers.map((n, i) => n.trim() || `Friend ${i + 1}`).join(' & ')}
                                </strong>{' '}
                                will be added to <strong>Lend</strong> ({formatCurrency(parseFloat(txAmount) / splitCount)}{' '}
                                each).
                              </p>
                            ) : (
                              <p className="text-[11px] text-amber-300">
                                ✓ Your share ({formatCurrency(parseFloat(txAmount) / splitCount)}) logs as Expense and is
                                added to <strong>Borrow</strong> (you owe{' '}
                                <strong>{splitMembers[Number(splitPaidBy)]?.trim() || `Friend ${Number(splitPaidBy) + 1}`}</strong>).
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3.5 rounded-2xl font-extrabold text-sm shadow-lg transition active:scale-98 ${
                    txType === 'expense'
                      ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-rose-500/20'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-emerald-500/20'
                  }`}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : txType === 'expense'
                    ? isSplitEnabled
                      ? 'Save Expense & Auto-Update Lend/Borrow'
                      : 'Save Expense'
                    : 'Save Income'}
                </button>
              </form>
            </section>

            {/* Full Searchable History */}
            <section className="rounded-3xl bg-[#111827] border border-slate-800 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-base text-white">Transaction History</h3>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-44">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Search..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <select
                    value={txFilterType}
                    onChange={(e) => setTxFilterType(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                  >
                    <option value="all">All</option>
                    <option value="expense">Expenses</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredTransactions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No matching transactions found.</p>
                ) : (
                  filteredTransactions.map((tx) => {
                    const cat = ALL_CATEGORIES_MAP[tx.category] || { label: tx.category, icon: Coins, color: '#94A3B8' };
                    const Icon = cat.icon;
                    const isInc = tx.type === 'income';
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{cat.label}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {tx.note || 'No note'} • {tx.paymentMethod} • {tx.date}
                              {tx.utr ? ` • UTR: ${tx.utr}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-extrabold ${isInc ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isInc ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {/* ==================== TAB 3: GROUP FUNDING & AUTO BILL-SPLITTER ==================== */}
        {activeTab === 'groups' && (
          <section className="space-y-5">
            <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" /> Group Funding & Bill Split
                  </h2>
                  <p className="text-xs text-slate-400">
                    Pool money with friends or split group bills directly into Lend & Borrow!
                  </p>
                </div>
              </div>

              {/* Sub-navigation */}
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 mb-5 text-[11px] sm:text-xs font-bold">
                <button
                  onClick={() => setGroupSubTab('my_groups')}
                  className={`py-2 rounded-xl transition ${groupSubTab === 'my_groups' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
                >
                  Pools ({groupFunds.length})
                </button>
                <button
                  onClick={() => setGroupSubTab('split_bill')}
                  className={`py-2 rounded-xl transition ${groupSubTab === 'split_bill' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}
                >
                  Split Bill
                </button>
                <button
                  onClick={() => setGroupSubTab('create')}
                  className={`py-2 rounded-xl transition ${groupSubTab === 'create' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                >
                  + New Pool
                </button>
                <button
                  onClick={() => setGroupSubTab('contribute')}
                  className={`py-2 rounded-xl transition ${groupSubTab === 'contribute' ? 'bg-indigo-400 text-slate-950' : 'text-slate-400'}`}
                >
                  Pay Pool
                </button>
              </div>

              {/* Sub-tab 1: My Groups & Leaderboard */}
              {groupSubTab === 'my_groups' && (
                <div className="space-y-4">
                  {groupFunds.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm font-semibold text-slate-200">No group funds yet</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Create a shared trip, rent, or party fund and share the invite code with friends!
                      </p>
                      <button
                        onClick={() => setGroupSubTab('create')}
                        className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                      >
                        Create First Group Fund
                      </button>
                    </div>
                  ) : (
                    groupFunds.map((grp) => {
                      const raised = (grp.contributions || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
                      const pct = Math.min(100, Math.round((raised / Math.max(1, grp.targetAmount)) * 100));
                      return (
                        <div key={grp.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-white text-base">{grp.name}</h4>
                              {grp.description && <p className="text-xs text-slate-400">{grp.description}</p>}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(grp.inviteCode || grp.id);
                                triggerToast(`Copied invite code: ${grp.inviteCode || grp.id}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" /> {grp.inviteCode || grp.id}
                            </button>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-emerald-400 font-bold">{formatCurrency(raised)} raised</span>
                              <span className="text-slate-400">Target: {formatCurrency(grp.targetAmount)} ({pct}%)</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                              />
                            </div>
                          </div>

                          {/* Visual Member Contribution Chart */}
                          {(grp.contributions || []).length > 0 && (() => {
                            const memberTotals = {};
                            (grp.contributions || []).forEach((c) => {
                              const name = c.userName || 'Member';
                              memberTotals[name] = (memberTotals[name] || 0) + (Number(c.amount) || 0);
                            });
                            const memberList = Object.entries(memberTotals)
                              .map(([name, total]) => ({
                                name,
                                total,
                                share: raised > 0 ? Math.round((total / raised) * 100) : 0
                              }))
                              .sort((a, b) => b.total - a.total);
                            const barColors = ['#10B981', '#06B6D4', '#F59E0B', '#EC4899', '#8B5CF6'];

                            return (
                              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                                <p className="text-[11px] font-semibold text-slate-300">Member Contribution Chart</p>
                                <div className="space-y-2">
                                  {memberList.map((m, idx) => (
                                    <div key={m.name}>
                                      <div className="flex justify-between text-[11px] mb-1">
                                        <span className="font-semibold text-slate-200">{m.name}</span>
                                        <span className="text-slate-400">
                                          {formatCurrency(m.total)} ({m.share}%)
                                        </span>
                                      </div>
                                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                                        <div
                                          style={{
                                            width: `${m.share}%`,
                                            backgroundColor: barColors[idx % barColors.length]
                                          }}
                                          className="h-full rounded-full transition-all duration-500"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <p className="text-[11px] font-semibold text-slate-400 pt-1">Recent Activity</p>
                                {grp.contributions.slice(-3).reverse().map((c, idx) => (
                                  <div key={idx} className="flex justify-between text-xs text-slate-300">
                                    <span>{c.userName} {c.note ? `(${c.note})` : ''}</span>
                                    <span className="font-bold text-emerald-400">+{formatCurrency(c.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          <button
                            onClick={() => {
                              setContribGroupId(grp.id);
                              setGroupSubTab('contribute');
                            }}
                            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300"
                          >
                            + Contribute to {grp.name}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Sub-tab: Quick Group Bill Splitter */}
              {groupSubTab === 'split_bill' && (
                <form onSubmit={handleGroupBillSplit} className="space-y-3.5">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                    Split any outing, dinner, or movie bill among friends — Finora calculates shares and logs Lend/Borrow automatically.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={billTitle}
                      onChange={(e) => setBillTitle(e.target.value)}
                      placeholder="Bill Title (e.g. Movie + Popcorn)"
                      required
                      className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={billTotal}
                      onChange={(e) => setBillTotal(e.target.value)}
                      placeholder="Total Bill Amount (₹)"
                      required
                      className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-300 font-semibold">People in Split (incl. You):</span>
                    <div className="flex gap-1.5">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setBillPeopleCount(n);
                            setBillFriendNames((prev) => {
                              const next = [...prev];
                              while (next.length < n - 1) next.push('');
                              return next.slice(0, n - 1);
                            });
                            if (billPayer !== 'me' && Number(billPayer) >= n - 1) setBillPayer('me');
                          }}
                          className={`w-8 h-8 rounded-lg text-xs font-bold ${
                            billPeopleCount === n ? 'bg-amber-400 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {billFriendNames.map((fn, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={fn}
                        onChange={(e) => {
                          const next = [...billFriendNames];
                          next[idx] = e.target.value;
                          setBillFriendNames(next);
                        }}
                        placeholder={`Friend ${idx + 1} name`}
                        required
                        className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Who paid the bill?</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setBillPayer('me')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                          billPayer === 'me'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        I Paid
                      </button>
                      {billFriendNames.map((fn, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setBillPayer(String(idx))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                            billPayer === String(idx)
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {fn.trim() || `Friend ${idx + 1}`} Paid
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-extrabold text-sm"
                  >
                    Split Bill & Update Lend/Borrow
                  </button>
                </form>
              )}

              {/* Sub-tab 2: Create or Join */}
              {groupSubTab === 'create' && (
                <div className="space-y-6">
                  <form onSubmit={handleCreateGroup} className="space-y-3">
                    <h4 className="text-sm font-bold text-white">Create New Group Fund</h4>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group Name (e.g. Goa Trip, Flat Rent)"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={newGroupTarget}
                      onChange={(e) => setNewGroupTarget(e.target.value)}
                      placeholder="Target Goal Amount (₹)"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                    />
                    <input
                      type="text"
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="Description (Optional)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                    />
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-sm"
                    >
                      Create Shared Group
                    </button>
                  </form>

                  <form onSubmit={handleJoinGroup} className="pt-4 border-t border-slate-800 space-y-3">
                    <h4 className="text-sm font-bold text-white">Join Friend's Group with Invite Code</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={joinGroupCode}
                        onChange={(e) => setJoinGroupCode(e.target.value)}
                        placeholder="e.g. FIN-8X29A"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm uppercase text-white"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs"
                      >
                        Join
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Sub-tab 3: Contribute */}
              {groupSubTab === 'contribute' && (
                <form onSubmit={handleGroupContribute} className="space-y-3.5">
                  <h4 className="text-sm font-bold text-white">Add Contribution (Counts in Your Expenses)</h4>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Select Group</label>
                    <select
                      value={contribGroupId || groupFunds[0]?.id || ''}
                      onChange={(e) => setContribGroupId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                    >
                      {groupFunds.length === 0 ? (
                        <option value="">Create a group first</option>
                      ) : (
                        groupFunds.map((g) => (
                          <option key={g.id} value={g.id}>{g.name} ({g.inviteCode || g.id})</option>
                        ))
                      )}
                    </select>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    placeholder="Contribution Amount (₹)"
                    required
                    className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-lg font-bold text-white"
                  />
                  <input
                    type="text"
                    value={contribNote}
                    onChange={(e) => setContribNote(e.target.value)}
                    placeholder="Note / UTR (Optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                  />
                  <button
                    type="submit"
                    disabled={groupFunds.length === 0}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-extrabold text-sm disabled:opacity-40"
                  >
                    Contribute & Log Expense
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* ==================== TAB 4: LEND, BORROW & LOANS/EMI PLANNER ==================== */}
        {activeTab === 'lend_loans' && (
          <section className="space-y-5">
            <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800 mb-5 text-xs font-bold">
                <button
                  onClick={() => setSocialSubTab('lend')}
                  className={`py-2.5 rounded-xl transition ${socialSubTab === 'lend' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'}`}
                >
                  Lend & Borrow Ledger
                </button>
                <button
                  onClick={() => setSocialSubTab('loans')}
                  className={`py-2.5 rounded-xl transition ${socialSubTab === 'loans' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400'}`}
                >
                  Loans & EMI Planner
                </button>
              </div>

              {/* SUB-VIEW A: LEND & BORROW */}
              {socialSubTab === 'lend' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-400">Friends Owe You</p>
                      <p className="text-lg font-extrabold text-emerald-400">{formatCurrency(lendSummary.toReceive)}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-400">You Owe Friends</p>
                      <p className="text-lg font-extrabold text-rose-400">{formatCurrency(lendSummary.toRepay)}</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddLendBorrow} className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLendDirection('lent')}
                        className={`py-2 rounded-xl text-xs font-bold border ${
                          lendDirection === 'lent'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        I Lent Money (Outflow)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLendDirection('borrowed')}
                        className={`py-2 rounded-xl text-xs font-bold border ${
                          lendDirection === 'borrowed'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        I Borrowed Money
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={lendPerson}
                        onChange={(e) => setLendPerson(e.target.value)}
                        placeholder="Friend's Name"
                        required
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={lendAmount}
                        onChange={(e) => setLendAmount(e.target.value)}
                        placeholder="Amount (₹)"
                        required
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-bold text-white"
                      />
                      <input
                        type="text"
                        value={lendPurpose}
                        onChange={(e) => setLendPurpose(e.target.value)}
                        placeholder="Purpose (e.g. Dinner split)"
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
                      />
                      <input
                        type="tel"
                        value={lendPhone}
                        onChange={(e) => setLendPhone(e.target.value)}
                        placeholder="WhatsApp Phone (Optional)"
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Due Date:</span>
                      <input
                        type="date"
                        value={lendDueDate}
                        onChange={(e) => setLendDueDate(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-extrabold text-xs"
                    >
                      Save Entry {lendDirection === 'lent' ? '(Counts in Expenses)' : ''}
                    </button>
                  </form>

                  {/* Lend & Borrow Records */}
                  <div className="space-y-2.5">
                    {lendEntries.map((item) => {
                      const waText = encodeURIComponent(
                        `Hi ${item.person}! Friendly reminder from Finora regarding ${formatCurrency(
                          item.amount
                        )}${item.purpose ? ` for ${item.purpose}` : ''} due on ${item.dueDate}.`
                      );
                      const cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');
                      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waText}` : `https://wa.me/?text=${waText}`;

                      return (
                        <div key={item.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.direction === 'lent'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-amber-500/15 text-amber-300'
                                }`}
                              >
                                {item.direction === 'lent' ? 'LENT' : 'BORROWED'}
                              </span>
                              <span className="font-bold text-sm text-white">{item.person}</span>
                              <span className="text-sm font-extrabold text-cyan-300">{formatCurrency(item.amount)}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {item.purpose || 'Personal'} • Due: {item.dueDate} • Status: {item.status}
                            </p>
                          </div>

                          {item.status === 'Pending' ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" /> Remind
                              </a>
                              <button
                                onClick={() => handleSettleLendBorrow(item)}
                                className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold"
                              >
                                Mark Returned
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-VIEW B: LOANS & EMI PLANNER */}
              {socialSubTab === 'loans' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-400">Outstanding Principal</p>
                      <p className="text-lg font-extrabold text-rose-400">{formatCurrency(loanSummary.totalPrincipal)}</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                      <p className="text-[11px] text-slate-400">Monthly EMI Burden</p>
                      <p className="text-lg font-extrabold text-cyan-400">{formatCurrency(loanSummary.monthlyEmi)}</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddLoan} className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Add Loan / EMI</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={loanName}
                        onChange={(e) => setLoanName(e.target.value)}
                        placeholder="Loan Name (e.g. Bike Loan)"
                        required
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={loanPrincipal}
                        onChange={(e) => setLoanPrincipal(e.target.value)}
                        placeholder="Remaining Principal (₹)"
                        required
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={loanEmi}
                        onChange={(e) => setLoanEmi(e.target.value)}
                        placeholder="Monthly EMI Amount (₹)"
                        required
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-bold text-white"
                      />
                      <input
                        type="number"
                        value={loanMonths}
                        onChange={(e) => setLoanMonths(e.target.value)}
                        placeholder="Remaining Months (e.g. 12)"
                        className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-extrabold text-xs"
                    >
                      Add Loan to Planner
                    </button>
                  </form>

                  <div className="space-y-2.5">
                    {loans.map((l) => (
                      <div key={l.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-white flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-cyan-400" /> {l.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">
                            Principal: <strong className="text-slate-200">{formatCurrency(l.principal)}</strong> • EMI:{' '}
                            <strong className="text-cyan-300">{formatCurrency(l.emi)}/mo</strong> • {l.remainingMonths} mos left
                          </p>
                        </div>
                        <button
                          onClick={() => handlePayEmi(l)}
                          disabled={(Number(l.remainingMonths) || 0) <= 0}
                          className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs disabled:opacity-40"
                        >
                          {(Number(l.remainingMonths) || 0) <= 0 ? 'Loan Paid Off' : 'Mark EMI Paid'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ==================== TAB 5: CHARTS, GOALS, THEMES & AUDIT LOG ==================== */}
        {activeTab === 'insights' && (
          <section className="space-y-5">
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#111827] border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setInsightSubTab('charts')}
                className={`py-2.5 rounded-xl transition ${insightSubTab === 'charts' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
              >
                Charts
              </button>
              <button
                onClick={() => setInsightSubTab('goals')}
                className={`py-2.5 rounded-xl transition ${insightSubTab === 'goals' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
              >
                Goals & Budget
              </button>
              <button
                onClick={() => setInsightSubTab('settings')}
                className={`py-2.5 rounded-xl transition ${insightSubTab === 'settings' ? 'bg-indigo-400 text-slate-950' : 'text-slate-400'}`}
              >
                Themes & Panda
              </button>
            </div>

            {/* SUB-TAB 1: DONUT, CATEGORY RANKING & OBLIGATIONS CHARTS */}
            {insightSubTab === 'charts' && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">All-Inclusive Expense Charts</h2>
                      <p className="text-xs text-slate-400">Includes direct expenses, group funds, lent & EMIs</p>
                    </div>
                    <button
                      onClick={() => setIsShareOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg"
                    >
                      <Camera className="w-3.5 h-3.5" /> Share Chart
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                    <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="46" fill="none" stroke="#1E293B" strokeWidth="16" />
                        {(() => {
                          const circumference = 2 * Math.PI * 46;
                          let offset = 0;
                          return stats.categoryBreakdown.map((cat) => {
                            const dash = (cat.percentage / 100) * circumference;
                            const el = (
                              <circle
                                key={cat.id}
                                cx="60"
                                cy="60"
                                r="46"
                                fill="none"
                                stroke={cat.color}
                                strokeWidth="16"
                                strokeDasharray={`${dash} ${circumference}`}
                                strokeDashoffset={-offset}
                              />
                            );
                            offset += dash;
                            return el;
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">All Expenses</span>
                        <span className="text-sm font-extrabold text-white mt-0.5">
                          {formatCurrency(stats.totalExpense)}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-3">
                      {stats.categoryBreakdown.length === 0 ? (
                        <p className="text-xs text-slate-400">Add expenses to view your visual breakdown!</p>
                      ) : (
                        stats.categoryBreakdown.map((cat) => (
                          <div key={cat.id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold text-slate-200 flex items-center gap-2">
                                <span style={{ backgroundColor: cat.color }} className="w-2.5 h-2.5 rounded-full" />
                                {cat.label}
                              </span>
                              <span className="text-slate-400 font-medium">
                                {formatCurrency(cat.amount)} ({cat.percentage}%)
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                              <div
                                style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                                className="h-full rounded-full"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Social & EMI Obligations Visual Bar Chart */}
                <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-white">Lend, Borrow & EMI Visual Snapshot</h3>
                    <p className="text-xs text-slate-400">Compare receivables, payables, and monthly loan commitments</p>
                  </div>

                  {(() => {
                    const maxObligation = Math.max(
                      lendSummary.toReceive,
                      lendSummary.toRepay,
                      loanSummary.monthlyEmi,
                      1
                    );
                    const bars = [
                      {
                        label: 'Friends Owe You (Lend)',
                        amount: lendSummary.toReceive,
                        color: '#10B981',
                        pct: Math.round((lendSummary.toReceive / maxObligation) * 100)
                      },
                      {
                        label: 'You Owe Friends (Borrow)',
                        amount: lendSummary.toRepay,
                        color: '#F59E0B',
                        pct: Math.round((lendSummary.toRepay / maxObligation) * 100)
                      },
                      {
                        label: 'Monthly Loan EMIs',
                        amount: loanSummary.monthlyEmi,
                        color: '#06B6D4',
                        pct: Math.round((loanSummary.monthlyEmi / maxObligation) * 100)
                      }
                    ];

                    return (
                      <div className="space-y-3">
                        {bars.map((b) => (
                          <div key={b.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-semibold text-slate-300">{b.label}</span>
                              <span className="font-bold text-white">{formatCurrency(b.amount)}</span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                              <div
                                style={{ width: `${Math.max(b.amount > 0 ? 6 : 0, b.pct)}%`, backgroundColor: b.color }}
                                className="h-full rounded-full transition-all duration-500"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* SUB-TAB 2: SAVINGS GOALS & BUDGET */}
            {insightSubTab === 'goals' && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 space-y-3">
                  <h3 className="text-base font-extrabold text-white">Monthly Budget Limit</h3>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-base font-bold text-white"
                    />
                    <button
                      onClick={() => {
                        const val = parseFloat(budgetDraft);
                        if (val > 0) {
                          setMonthlyBudget(val);
                          saveUserPreferences({ monthlyBudget: val });
                          triggerToast(`Budget updated to ${formatCurrency(val)}`);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 space-y-4">
                  <h3 className="text-base font-extrabold text-white">Personal Savings Goals</h3>
                  <form onSubmit={handleCreateGoal} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      placeholder="Goal (e.g. New Laptop)"
                      required
                      className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      placeholder="Target (₹)"
                      required
                      className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      + Create Goal
                    </button>
                  </form>

                  <div className="space-y-3">
                    {savingsGoals.map((g) => {
                      const pct = Math.min(100, Math.round(((Number(g.saved) || 0) / Math.max(1, g.target)) * 100));
                      return (
                        <div key={g.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-white">{g.name}</span>
                            <span className="text-emerald-400">
                              {formatCurrency(g.saved)} / {formatCurrency(g.target)} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                            <div style={{ width: `${pct}%` }} className="h-full bg-emerald-400 rounded-full" />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={goalAddMap[g.id] || ''}
                              onChange={(e) => setGoalAddMap((p) => ({ ...p, [g.id]: e.target.value }))}
                              placeholder="Add ₹"
                              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                            />
                            <button
                              onClick={() => handleAddToGoal(g)}
                              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: 12 THEME PACKS, PANDA COMPANION SHOWCASE, ACCOUNT & AUDIT LOG */}
            {insightSubTab === 'settings' && (
              <div className="space-y-5">
                <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{user.displayName || 'Finora User'}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </div>

                  {/* 12 Finora Theme Packs Switcher */}
                  <div className="pt-3 border-t border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Palette className="w-4 h-4 text-cyan-400" /> Finora Theme Packs (12 Styles)
                      </label>
                      <span className="text-[11px] text-cyan-300 font-semibold">{activeThemeName}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(THEME_PACKS).map((tp) => {
                        const isSelected = activeThemeName === tp.label;
                        return (
                          <button
                            key={tp.label}
                            type="button"
                            onClick={() => {
                              setActiveThemeName(tp.label);
                              saveUserPreferences({ themeName: tp.label });
                              triggerToast(`Theme switched to ${tp.label}`);
                            }}
                            style={{ backgroundColor: tp.card, borderColor: isSelected ? tp.accent : tp.border }}
                            className="p-2.5 rounded-2xl border-2 text-left transition active:scale-97"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span style={{ color: tp.text }} className="text-xs font-extrabold truncate">
                                {tp.label}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span style={{ backgroundColor: tp.accent }} className="w-2.5 h-2.5 rounded-full" />
                                <span style={{ backgroundColor: tp.accent2 }} className="w-2.5 h-2.5 rounded-full" />
                              </div>
                            </div>
                            <p style={{ color: tp.muted }} className="text-[10px] truncate">
                              {tp.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rename Panda */}
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <label className="block text-xs font-semibold text-slate-300">Customize Holographic Panda Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={18}
                        value={pandaName}
                        onChange={(e) => setPandaName(e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-white"
                      />
                      <button
                        onClick={() => {
                          const clean = pandaName.trim() || 'Pando';
                          setPandaName(clean);
                          saveUserPreferences({ pandaName: clean });
                          triggerToast(`Renamed to ${clean}!`);
                        }}
                        className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Toggle Speech Bubbles */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-xs font-bold text-white">Floating Speech Bubble Nudges</p>
                      <p className="text-[11px] text-slate-400">Turn on/off popup messages above {pandaName}</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = !chatEnabled;
                        setChatEnabled(next);
                        saveUserPreferences({ chatEnabled: next });
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                        chatEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {chatEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Preview All 17 Activity Animations */}
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <p className="text-xs font-semibold text-slate-300">
                      Preview {pandaName}'s Activity Animations (Tap any)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'fuel', label: '⛽ Fuel' },
                        { id: 'groceries', label: '🛒 Groceries' },
                        { id: 'foodie', label: '🍔 Ate Full' },
                        { id: 'travel', label: '✈️ Travel' },
                        { id: 'transport', label: '🚕 Transport' },
                        { id: 'shopping', label: '🛍️ Shopping' },
                        { id: 'bills', label: '⚡ Bills' },
                        { id: 'education', label: '🎓 Education' },
                        { id: 'health', label: '💚 Health' },
                        { id: 'entertainment', label: '🍿 Movies' },
                        { id: 'rent', label: '🏠 Rent' },
                        { id: 'savings', label: '🐷 Savings/Group' },
                        { id: 'lend_emi', label: '🤝 Lend/EMI' },
                        { id: 'rich_income', label: '💵 Salary/Income' },
                        { id: 'pocket_money', label: '🎉 Pocket Money' },
                        { id: 'sad', label: '💸 Overspent' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setPandaMood(m.id);
                            setPandaBubble(`Previewing ${m.label} animation! Drag me anywhere or tap me for coaching.`);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
                            pandaMood === m.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Activity Audit Log */}
                <div className="rounded-3xl bg-[#111827] border border-slate-800 p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" /> Activity Audit Log
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {auditLogs.length === 0 ? (
                      <p className="text-xs text-slate-500">No recent audit events yet.</p>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="text-xs text-slate-300 flex justify-between gap-2 py-1 border-b border-slate-800/60">
                          <span className="truncate">{log.action}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ====================================================================
          UNIVERSAL FLOATING CIRCULAR CALCULATOR BUTTON ON ALL TABS
         ==================================================================== */}
      <button
        onClick={() => setIsCalcOpen(true)}
        aria-label="Open Calculator"
        title="Quick Calculator"
        className="fixed right-4 bottom-24 md:bottom-8 z-30 p-3.5 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 text-slate-950 shadow-[0_8px_25px_rgba(6,182,212,0.45)] hover:scale-105 active:scale-95 transition flex items-center justify-center"
      >
        <Calculator className="w-6 h-6 stroke-[2.25]" />
      </button>

      {/* ====================================================================
          3D HOLOGRAPHIC DRAGGABLE PANDA COMPANION
         ==================================================================== */}
      <HolographicPandaBot
        mood={pandaMood}
        pandaName={pandaName}
        bubbleText={pandaBubble}
        chatEnabled={chatEnabled}
        onOpenCoach={() => setIsCoachOpen(true)}
        onDismissBubble={() => setPandaBubble('')}
      />

      {/* ====================================================================
          MOBILE FLOATING BOTTOM NAVIGATION BAR (5 TABS)
         ==================================================================== */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-30 rounded-2xl bg-[#0F172A]/95 backdrop-blur-xl border border-slate-800/90 px-2 py-1.5 shadow-2xl flex items-center justify-around">
        {[
          { id: 'dashboard', label: 'Home', icon: Wallet },
          { id: 'groups', label: 'Groups', icon: Users },
          { id: 'transactions', label: 'Add', icon: Plus, isCenter: true },
          { id: 'lend_loans', label: 'Lend/EMI', icon: HandCoins },
          { id: 'insights', label: 'More', icon: PieChart }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          if (tab.isCenter) {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab('transactions')}
                className="w-12 h-12 -mt-5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-400 text-slate-950 shadow-lg shadow-emerald-500/30 flex items-center justify-center active:scale-95 transition"
                aria-label="Add Transaction"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition ${
                active ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ====================================================================
          MODALS: CALCULATOR, AI MONEY COACH, SHARE SNAPSHOT, PWA INSTALL GUIDE
         ==================================================================== */}
      <FloatingCalculator
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
        onApplyResult={(val) => {
          setTxAmount(val);
          setActiveTab('transactions');
          triggerToast(`Inserted ₹${val} into transaction`);
        }}
      />

      <MoneyCoachModal
        isOpen={isCoachOpen}
        onClose={() => setIsCoachOpen(false)}
        pandaName={pandaName}
        onRenamePanda={(newName) => {
          setPandaName(newName);
          saveUserPreferences({ pandaName: newName });
          triggerToast(`Renamed to ${newName}`);
        }}
        transactions={transactions}
        monthlyBudget={monthlyBudget}
        stats={stats}
        lendSummary={lendSummary}
        loanSummary={loanSummary}
        groupsCount={groupFunds.length}
        chatEnabled={chatEnabled}
        onToggleChat={() => {
          const next = !chatEnabled;
          setChatEnabled(next);
          saveUserPreferences({ chatEnabled: next });
        }}
      />

      <ShareSnapshotModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        user={user}
        stats={stats}
        pandaName={pandaName}
        mood={pandaMood}
      />

      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D1322] border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <Smartphone className="w-4 h-4" /> Install Finora Mobile App
              </div>
              <button onClick={() => setShowInstallModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Install Finora directly onto your phone’s home screen for a full-screen native app experience:
            </p>
            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <p><strong className="text-emerald-400">Android (Chrome):</strong> Tap the <span className="font-bold">⋮ menu</span> in the top-right corner and select <span className="font-bold">"Install app"</span> or <span className="font-bold">"Add to Home screen"</span>.</p>
              <p><strong className="text-cyan-400">iPhone / iPad (Safari):</strong> Tap the <span className="font-bold">Share icon</span> at the bottom and choose <span className="font-bold">"Add to Home Screen"</span>.</p>
            </div>
            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/95 border border-cyan-400/50 text-xs font-semibold text-white shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* CSV BANK STATEMENT BULK IMPORT MODAL */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0D1322] border border-slate-700 p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <FileText className="w-4 h-4" /> Import Bank / GPay CSV
              </div>
              <button
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvPreviewRows([]);
                  setCsvError('');
                }}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Upload a CSV with columns: <code className="text-cyan-300">date, description, amount, type</code> (and optional{' '}
              <code className="text-cyan-300">category, reference, payment_method</code>).
            </p>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileSelect}
              className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400"
            />

            {csvError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {csvError}
              </div>
            )}

            {csvPreviewRows.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-1.5 border border-slate-800 rounded-2xl p-3 bg-slate-950">
                <p className="text-xs font-bold text-emerald-400 mb-2">
                  Ready to import {csvPreviewRows.length} rows:
                </p>
                {csvPreviewRows.slice(0, 15).map((r, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-300 border-b border-slate-800/60 pb-1">
                    <span className="truncate pr-2">{r.date} • {r.description}</span>
                    <span className={`font-bold shrink-0 ${r.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={csvPreviewRows.length === 0 || isSubmitting}
              onClick={handleConfirmCsvImport}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs disabled:opacity-40"
            >
              {isSubmitting ? 'Importing...' : `Import ${csvPreviewRows.length || ''} Transactions`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}