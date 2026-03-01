import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Briefcase, Loader2, LogOut, Mail, Lock } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// --- CONFIGURAÇÃO DO FIREBASE ---
// ⚠️ ATENÇÃO PARA O SEU PROJETO LOCAL (VITE):
// Quando for rodar no seu computador, descomente o bloco abaixo e apague a configuração de teste!

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
const appId = 'controle-trabalho';

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
    // Usando o UID do usuário para criar uma pasta segura só para ele
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
        case 'auth/invalid-email':
          setAuthError('E-mail inválido.');
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setAuthError('E-mail ou senha incorretos.');
          break;
        case 'auth/email-already-in-use':
          setAuthError('Este e-mail já está cadastrado.');
          break;
        case 'auth/weak-password':
          setAuthError('A senha deve ter pelo menos 6 caracteres.');
          break;
        default:
          setAuthError('Ocorreu um erro ao tentar entrar.');
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-red-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-red-600 text-white p-8 text-center">
            <div className="bg-white/20 p-4 rounded-full inline-block mb-4">
              <CalendarIcon size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold">Escala de Trabalho</h1>
            <p className="text-red-100 mt-2">Faça login para continuar</p>
          </div>
          
          <div className="p-8">
            <form onSubmit={handleAuthSubmit} className="space-y-5">
              {authError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium border border-red-200">
                  {authError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                    placeholder="mae@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center"
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
                className="text-sm text-slate-500 hover:text-red-600 transition-colors font-medium"
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
          relative min-h-[80px] sm:min-h-[100px] p-2 border rounded-xl flex flex-col items-center justify-start transition-all duration-200 ease-in-out
          ${isWorkDay 
            ? 'bg-red-500 border-red-600 text-white shadow-md transform scale-[1.02]' 
            : 'bg-white border-slate-200 text-slate-700 hover:bg-red-50 hover:border-red-200'
          }
          ${isToday && !isWorkDay ? 'ring-2 ring-blue-400' : ''}
        `}
      >
        <span className={`text-lg font-bold ${isWorkDay ? 'text-white' : 'text-slate-800'}`}>
          {day}
        </span>
        
        {isWorkDay && (
          <div className="mt-1 flex flex-col items-center animate-fade-in">
            <Briefcase size={16} className="mb-1 opacity-90" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-center leading-tight">
              Dia de<br/>Trabalho
            </span>
          </div>
        )}
      </button>
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        
        <div className="bg-red-600 text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="bg-white/20 p-3 rounded-2xl hidden sm:block">
              <CalendarIcon size={32} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Escala de Trabalho</h1>
              <div className="flex items-center justify-between sm:justify-start gap-3 mt-1">
                <p className="text-red-100 text-sm font-medium truncate max-w-[150px]">{user.email}</p>
                {isDataLoading ? (
                  <span className="flex items-center text-xs bg-red-500 px-2 py-0.5 rounded-full shadow-inner animate-pulse">
                    <Loader2 size={12} className="animate-spin mr-1" /> Sinc.
                  </span>
                ) : (
                  <span className="text-xs bg-green-500/20 text-green-100 px-2 py-0.5 rounded-full border border-green-500/30 flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 shadow-[0_0_4px_#4ade80]"></span>
                    Salvo
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="bg-white text-red-600 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-sm text-center">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-red-400 mb-0.5">Neste mês</p>
              <p className="text-xl sm:text-2xl font-black leading-none">
                {workDaysThisMonth} <span className="text-sm font-semibold text-red-500">{workDaysThisMonth === 1 ? 'dia' : 'dias'}</span>
              </p>
            </div>
            
            <button 
              onClick={handleLogout}
              className="bg-red-700 hover:bg-red-800 p-3 rounded-2xl transition-colors text-white"
              title="Sair da conta"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <button 
              onClick={prevMonth}
              className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-600 hover:text-red-600"
            >
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-2xl font-bold text-slate-700 capitalize">
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <button 
              onClick={nextMonth}
              className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-600 hover:text-red-600"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center font-bold text-slate-400 text-sm uppercase py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {blanks}
            {days}
          </div>
        </div>
      </div>
    </div>
  );
}