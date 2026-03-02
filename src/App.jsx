import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Briefcase, Loader2, LogOut, Mail, Lock, Sun, Moon } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// --- CONFIGURAÇÃO DE TESTE / LOCAL ---
let firebaseConfig = {};
let appId = 'controle-trabalho';

try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  }
  if (typeof __app_id !== 'undefined') {
    appId = __app_id;
  }
} catch (error) {
  console.error("Erro ao carregar configuração:", error);
}

// ⚠️ PARA RODAR NO SEU COMPUTADOR (VITE):
// Quando for enviar o código para a sua máquina, descomente o bloco abaixo.

firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- MODO ESCURO E CORES DA BARRA DO CELULAR ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Cria ou atualiza a meta tag para colorir a barra de status do celular
    let metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.name = "theme-color";
      document.head.appendChild(metaThemeColor);
    }

    if (isDarkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      // Pinta o fundo do corpo para evitar branco ao "puxar" a tela no iPhone
      document.body.style.backgroundColor = '#0f172a'; 
      // Se logado: topo vermelho escuro. Se não: topo fundo escuro
      metaThemeColor.setAttribute("content", user ? "#b91c1c" : "#0f172a"); 
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
      document.body.style.backgroundColor = '#f8fafc'; 
      // Se logado: topo vermelho claro. Se não: topo fundo claro
      metaThemeColor.setAttribute("content", user ? "#dc2626" : "#f8fafc");
    }
  }, [isDarkMode, user]);

  // --- ESTADOS DO CALENDÁRIO ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workDays, setWorkDays] = useState({});
  const [isDataLoading, setIsDataLoading] = useState(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // --- LÓGICA DE SWIPE (ARRASTAR NO CELULAR) ---
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) nextMonth();
    if (isRightSwipe) prevMonth();
  };

  // --- EFEITOS (USEEFFECT) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkDays({});
      return;
    }

    setIsDataLoading(true);
    const workDaysRef = collection(db, 'usuarios', user.uid, 'diasTrabalho');

    const unsubscribe = onSnapshot(workDaysRef, (snapshot) => {
      const fetchedDays = {};
      snapshot.forEach((doc) => {
        fetchedDays[doc.id] = true;
      });
      setWorkDays(fetchedDays);
      setIsDataLoading(false);
    }, (error) => {
      console.error("Erro ao buscar dados:", error);
      setIsDataLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- FUNÇÕES DE AUTENTICAÇÃO ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error("Erro de Autenticação:", error);
      switch (error.code) {
        case 'auth/invalid-email': setAuthError('E-mail inválido.'); break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': setAuthError('E-mail ou senha incorretos.'); break;
        case 'auth/email-already-in-use': setAuthError('Este e-mail já está cadastrado.'); break;
        case 'auth/weak-password': setAuthError('A senha deve ter pelo menos 6 caracteres.'); break;
        default: setAuthError('Ocorreu um erro ao tentar entrar.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  // --- FUNÇÕES DO CALENDÁRIO ---
  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  
  const getDateString = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const toggleWorkDay = async (day) => {
    if (!user) return;
    
    const dateStr = getDateString(currentYear, currentMonth, day);
    const isCurrentlyWorkDay = workDays[dateStr];

    setWorkDays(prev => ({ ...prev, [dateStr]: !isCurrentlyWorkDay }));

    try {
      const docRef = doc(db, 'usuarios', user.uid, 'diasTrabalho', dateStr);
      if (isCurrentlyWorkDay) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, { active: true });
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setWorkDays(prev => ({ ...prev, [dateStr]: isCurrentlyWorkDay }));
      alert("Erro ao salvar no banco de dados. Verifique a internet.");
    }
  };

  // --- RENDERIZAÇÃO DA TELA DE LOGIN ---
  if (isAuthLoading && !user) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <Loader2 size={48} className="animate-spin text-red-600 dark:text-red-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex flex-col sm:items-center sm:justify-center bg-slate-50 dark:bg-slate-900 sm:p-4 font-sans relative transition-colors duration-300">
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors z-10"
          title="Alternar modo escuro"
        >
          {isDarkMode ? <Sun size={24} className="text-amber-400" /> : <Moon size={24} className="text-slate-600" />}
        </button>

        <div className="flex-1 sm:flex-none max-w-md w-full bg-white dark:bg-slate-800 sm:rounded-3xl sm:shadow-xl overflow-hidden transition-colors duration-300 flex flex-col justify-center">
          <div className="bg-red-600 dark:bg-red-700 text-white p-8 pt-12 sm:pt-8 text-center transition-colors duration-300 shadow-sm z-0">
            <div className="bg-white/20 p-4 rounded-full inline-block mb-4 mt-8 sm:mt-0">
              <CalendarIcon size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold">Escala de Trabalho</h1>
            <p className="text-red-100 mt-2">Faça login para continuar</p>
          </div>
          
          <div className="p-8 pb-12 sm:pb-8 flex-1 flex flex-col justify-center">
            <form onSubmit={handleAuthSubmit} className="space-y-5">
              {authError && (
                <div className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center font-medium border border-red-200 dark:border-red-800/50">
                  {authError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={18} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    placeholder="mae@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center shadow-lg shadow-red-600/20 dark:shadow-none"
              >
                {isAuthLoading ? <Loader2 size={20} className="animate-spin" /> : (isLoginMode ? 'Entrar' : 'Criar Conta')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setAuthError('');
                }}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors font-medium p-2"
              >
                {isLoginMode ? 'Não tem uma conta? Crie aqui.' : 'Já tem uma conta? Faça login.'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO DO CALENDÁRIO ---
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  
  const workDaysThisMonth = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(day => {
    return workDays[getDateString(currentYear, currentMonth, day)];
  }).length;

  const blanks = Array.from({ length: firstDay }, (_, i) => (
    <div key={`blank-${i}`} className="p-2 border border-transparent"></div>
  ));

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = getDateString(currentYear, currentMonth, day);
    const isWorkDay = workDays[dateStr];
    const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();

    return (
      <button
        key={day}
        onClick={() => toggleWorkDay(day)}
        className={`
          relative min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border rounded-xl flex flex-col items-center justify-start transition-all duration-200 ease-in-out touch-manipulation
          ${isWorkDay 
            ? 'bg-red-500 border-red-600 text-white shadow-md transform scale-[1.02] dark:bg-red-600 dark:border-red-500 dark:shadow-red-900/20' 
            : 'bg-white border-slate-200 text-slate-700 hover:bg-red-50 hover:border-red-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:border-slate-500'
          }
          ${isToday && !isWorkDay ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}
        `}
      >
        <span className={`text-lg sm:text-xl font-bold ${isWorkDay ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
          {day}
        </span>
        
        {isWorkDay && (
          <div className="mt-1 flex flex-col items-center animate-fade-in w-full">
            <Briefcase size={14} className="mb-0.5 opacity-90 sm:w-4 sm:h-4" />
            <span className="text-[9px] sm:text-xs font-semibold uppercase tracking-tight text-center leading-tight">
              Trabalho
            </span>
          </div>
        )}
      </button>
    );
  });

  return (
    <div className="min-h-[100dvh] flex flex-col sm:items-center sm:justify-center bg-slate-50 dark:bg-slate-900 sm:p-4 font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">
      <div className="max-w-4xl w-full flex-1 sm:flex-none flex flex-col bg-white dark:bg-slate-800 sm:rounded-3xl sm:shadow-xl overflow-hidden transition-colors duration-300">
        
        {/* CABEÇALHO */}
        <div className="bg-red-600 dark:bg-red-700 text-white pt-10 pb-6 px-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors duration-300 shadow-sm z-10">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 sm:p-3 rounded-2xl hidden sm:block">
                <CalendarIcon size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Escala de Trabalho</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-red-100 text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-[200px]">{user.email}</p>
                  {isDataLoading ? (
                    <span className="flex items-center text-[10px] sm:text-xs bg-red-500 dark:bg-red-600 px-2 py-0.5 rounded-full shadow-inner animate-pulse">
                      <Loader2 size={10} className="animate-spin mr-1" /> Sinc.
                    </span>
                  ) : (
                    <span className="text-[10px] sm:text-xs bg-green-500/20 text-green-100 px-2 py-0.5 rounded-full border border-green-500/30 flex items-center">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1 shadow-[0_0_4px_#4ade80]"></span>
                      Salvo
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* BOTÃO MODO ESCURO - MOBILE */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="sm:hidden bg-red-700 hover:bg-red-800 dark:bg-slate-800 dark:hover:bg-slate-700 p-2.5 rounded-full transition-colors text-white shadow-sm"
              title="Alternar modo escuro"
            >
              {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
            {/* BOTÃO MODO ESCURO - DESKTOP */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="hidden sm:block bg-red-700 hover:bg-red-800 dark:bg-slate-800 dark:hover:bg-slate-700 p-3 rounded-2xl transition-colors text-white shadow-sm"
              title="Alternar modo escuro"
            >
              {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
            </button>

            <div className="flex-1 sm:flex-none bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-sm text-center transition-colors">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-red-400 dark:text-red-500 mb-0.5">Neste mês</p>
              <p className="text-lg sm:text-2xl font-black leading-none">
                {workDaysThisMonth} <span className="text-xs sm:text-sm font-semibold text-red-500">{workDaysThisMonth === 1 ? 'dia' : 'dias'}</span>
              </p>
            </div>
            
            <button 
              onClick={handleLogout}
              className="bg-red-700 hover:bg-red-800 dark:bg-slate-800 dark:hover:bg-slate-700 p-3 rounded-2xl transition-colors text-white shadow-sm"
              title="Sair da conta"
            >
              <LogOut size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* ÁREA DO CALENDÁRIO COM SUPORTE A SWIPE */}
        <div 
          className="p-3 sm:p-8 select-none flex-1 bg-slate-50 dark:bg-slate-800"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* NAVEGAÇÃO DOS MESES */}
          <div className="flex justify-between items-center mb-4 sm:mb-6 bg-white dark:bg-slate-800/50 p-1 sm:p-2 rounded-2xl shadow-sm sm:shadow-none border border-slate-100 sm:border-none dark:border-slate-700">
            <button 
              onClick={prevMonth}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-slate-600 rounded-xl transition-all text-slate-700 dark:text-slate-200 active:scale-95"
            >
              <ChevronLeft size={20} />
              <span className="hidden sm:block font-bold">Anterior</span>
            </button>
            
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-700 dark:text-slate-200 capitalize text-center flex-1">
              {monthNames[currentMonth]} <span className="text-red-600 dark:text-red-400">{currentYear}</span>
            </h2>
            
            <button 
              onClick={nextMonth}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-slate-600 rounded-xl transition-all text-slate-700 dark:text-slate-200 active:scale-95"
            >
              <span className="hidden sm:block font-bold">Próximo</span>
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center font-bold text-slate-400 dark:text-slate-500 text-[10px] sm:text-sm uppercase py-1 sm:py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-3">
            {blanks}
            {days}
          </div>
        </div>
        
        {/* Dica para mobile - Fica sempre visível no rodapé */}
        <div className="bg-slate-100 dark:bg-slate-900 p-4 text-center text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 sm:hidden">
          Arraste para os lados para mudar de mês
        </div>

      </div>
    </div>
  );
}