import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  ArrowUpRight, ArrowDownLeft, Wallet, PieChart, History, Plus, 
  Trash2, X, AlertCircle, ChevronDown, ChevronUp, Lock, RefreshCw, 
  TrendingUp, CreditCard, Calendar, Filter, Search, Edit2, RotateCcw, 
  LayoutGrid, List, CheckCircle2, UserPlus, Users
} from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, Legend } from 'recharts';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURATION ---
const APP_TITLE = "Biya's Vault";
const DB_PREFIX = 'biya_vault_'; // Separate database prefix
const THEME_COLOR = 'rose'; // Pink Theme

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyAOFOgjdbdoUYBTldXOEEG636q1EM8EBfc",
  authDomain: "leanaxis-accounts.firebaseapp.com",
  projectId: "leanaxis-accounts",
  storageBucket: "leanaxis-accounts.firebasestorage.app",
  messagingSenderId: "855221056961",
  appId: "1:855221056961:web:b4129012fa0f56f58a6b40"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- HELPER HOOKS ---
function useFirebaseSync(collectionName, defaultValue = []) {
  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, `${DB_PREFIX}${collectionName}`), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(items);
      setLoading(false);
    }, (error) => {
      console.error(`Error syncing ${collectionName}:`, error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [collectionName]);

  return [data, loading];
}

// --- COMPONENTS ---
const StatCard = ({ label, amount, icon: Icon, color, subLabel }) => (
  <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-5 rounded-2xl relative overflow-hidden group">
    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${color}`}>
      <Icon size={80} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-xl bg-white/10 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <span className="text-slate-400 text-sm font-medium">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white tracking-tight">
      {amount.toLocaleString()} <span className="text-sm font-normal text-slate-500">PKR</span>
    </div>
    {subLabel && <div className="text-xs text-slate-500 mt-1">{subLabel}</div>}
  </div>
);

// --- MAIN APP ---
const App = () => {
  // State
  const [view, setView] = useState('dashboard'); // dashboard, transactions, investments, kameti
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [showAddKameti, setShowAddKameti] = useState(false);
  const [showAddMoney, setShowAddMoney] = useState(null); // Account ID to add money to
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Firebase Data
  const [transactions] = useFirebaseSync('transactions');
  const [accounts] = useFirebaseSync('accounts');
  const [investments] = useFirebaseSync('investments');
  const [kametis] = useFirebaseSync('kametis');

  // Form States
  const [newTx, setNewTx] = useState({ type: 'Expense', amount: '', category: 'Food', description: '', accountId: '', date: new Date().toISOString().split('T')[0] });
  const [newAccount, setNewAccount] = useState({ name: '', type: 'Bank', balance: '' });
  const [newInvestment, setNewInvestment] = useState({ name: '', value: '', type: 'Gold' });
  const [newKameti, setNewKameti] = useState({ name: '', totalAmount: '', members: '', contribution: '', startDate: '' });
  const [addMoneyAmount, setAddMoneyAmount] = useState('');

  // Authentication
  useEffect(() => {
    const savedAuth = localStorage.getItem('biya_vault_auth');
    if (savedAuth === 'true') setIsAuthenticated(true);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === '0000') { // Default PIN
      setIsAuthenticated(true);
      localStorage.setItem('biya_vault_auth', 'true');
    } else {
      alert('Incorrect PIN');
    }
  };

  // Calculations
  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.value), 0);
  const currentMonthExpense = transactions
    .filter(t => t.type === 'Expense' && t.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Kameti Calculations
  const kametiTotalCollected = kametis.reduce((sum, k) => sum + (Number(k.collected) || 0), 0);
  
  // Handlers
  const handleAddTx = async (e) => {
    e.preventDefault();
    if (!newTx.accountId) return alert('Select an account');
    
    const account = accounts.find(a => a.id === newTx.accountId);
    const amount = Number(newTx.amount);

    if (newTx.type === 'Expense' && account.balance < amount) return alert('Insufficient balance');

    const batch = writeBatch(db);
    
    // 1. Add Transaction
    const txRef = doc(collection(db, `${DB_PREFIX}transactions`));
    batch.set(txRef, { ...newTx, amount, createdAt: new Date().toISOString() });

    // 2. Update Account Balance
    const newBalance = newTx.type === 'Expense' ? Number(account.balance) - amount : Number(account.balance) + amount;
    const accRef = doc(db, `${DB_PREFIX}accounts`, newTx.accountId);
    batch.update(accRef, { balance: newBalance });

    await batch.commit();
    setShowAddModal(false);
    setNewTx({ type: 'Expense', amount: '', category: 'Food', description: '', accountId: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, `${DB_PREFIX}accounts`), { ...newAccount, balance: Number(newAccount.balance), createdAt: new Date().toISOString() });
    setShowAddAccount(false);
    setNewAccount({ name: '', type: 'Bank', balance: '' });
  };

  const handleAddMoney = async (e) => {
    e.preventDefault();
    if (!showAddMoney) return;
    
    const account = accounts.find(a => a.id === showAddMoney);
    const amount = Number(addMoneyAmount);
    
    const batch = writeBatch(db);
    
    // Add "Deposit" Transaction
    const txRef = doc(collection(db, `${DB_PREFIX}transactions`));
    batch.set(txRef, { 
      type: 'Credit', 
      amount, 
      category: 'Deposit', 
      description: 'Manual Deposit', 
      accountId: showAddMoney, 
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString() 
    });

    // Update Balance
    const accRef = doc(db, `${DB_PREFIX}accounts`, showAddMoney);
    batch.update(accRef, { balance: Number(account.balance) + amount });

    await batch.commit();
    setShowAddMoney(null);
    setAddMoneyAmount('');
  };
  
  const handleAddKameti = async (e) => {
      e.preventDefault();
      await addDoc(collection(db, `${DB_PREFIX}kametis`), { 
          ...newKameti, 
          collected: 0, 
          status: 'Active',
          createdAt: new Date().toISOString() 
      });
      setShowAddKameti(false);
      setNewKameti({ name: '', totalAmount: '', members: '', contribution: '', startDate: '' });
  };
  
  const handleKametiPayment = async (kametiId, currentCollected, contribution) => {
      if(!confirm("Mark this month's payment as received?")) return;
      await updateDoc(doc(db, `${DB_PREFIX}kametis`, kametiId), {
          collected: Number(currentCollected) + Number(contribution)
      });
  };

  // Render Login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-rose-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-rose-500/20">
              <Lock className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{APP_TITLE}</h1>
            <p className="text-slate-400">Enter PIN to access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              maxLength="4"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-center text-2xl tracking-[1em] text-white focus:border-rose-500 outline-none transition-colors"
              placeholder="••••"
              autoFocus
            />
            <button className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98]">
              Unlock Vault
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 md:pb-0 md:pl-20">
      
      {/* SIDEBAR (Desktop) */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-8 bg-slate-900 border-r border-slate-800 z-50">
        <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center mb-8 shadow-lg shadow-rose-500/20">
          <Wallet className="text-white" size={20} />
        </div>
        <nav className="flex-1 flex flex-col gap-4">
          <button onClick={() => setView('dashboard')} className={`p-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-rose-500/10 text-rose-500' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutGrid size={24}/></button>
          <button onClick={() => setView('transactions')} className={`p-3 rounded-xl transition-all ${view === 'transactions' ? 'bg-rose-500/10 text-rose-500' : 'text-slate-400 hover:bg-slate-800'}`}><List size={24}/></button>
          <button onClick={() => setView('investments')} className={`p-3 rounded-xl transition-all ${view === 'investments' ? 'bg-rose-500/10 text-rose-500' : 'text-slate-400 hover:bg-slate-800'}`}><TrendingUp size={24}/></button>
          <button onClick={() => setView('kameti')} className={`p-3 rounded-xl transition-all ${view === 'kameti' ? 'bg-rose-500/10 text-rose-500' : 'text-slate-400 hover:bg-slate-800'}`}><Users size={24}/></button>
        </nav>
      </div>

      {/* HEADER */}
      <header className="px-6 py-6 flex justify-between items-center sticky top-0 bg-slate-950/80 backdrop-blur-md z-40">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{APP_TITLE}</h1>
          <p className="text-xs text-slate-400 font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-500 p-[2px]">
           <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-xs font-bold">BV</div>
        </div>
      </header>

      <main className="px-6 space-y-6 max-w-5xl mx-auto">
        
        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Total Balance" amount={totalBalance} icon={Wallet} color="text-rose-400" />
              <StatCard label="Investments" amount={totalInvested} icon={TrendingUp} color="text-emerald-400" />
              <StatCard label="Monthly Expense" amount={currentMonthExpense} icon={ArrowUpRight} color="text-orange-400" subLabel="This Month" />
            </div>

            {/* Accounts List */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">My Accounts</h2>
                <button onClick={() => setShowAddAccount(true)} className="text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 transition-colors">+ Add Account</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accounts.map(acc => (
                  <div key={acc.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-800 rounded-xl text-slate-300 group-hover:text-white transition-colors">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{acc.name}</h3>
                        <p className="text-xs text-slate-500">{acc.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-white">{Number(acc.balance).toLocaleString()}</p>
                       <button onClick={() => setShowAddMoney(acc.id)} className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded mt-1 hover:bg-emerald-500/20 transition-colors">+ Add Funds</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="fixed bottom-6 right-6 md:hidden">
                <button onClick={() => setShowAddModal(true)} className="w-14 h-14 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/30 active:scale-95 transition-transform">
                    <Plus size={28} />
                </button>
            </div>
          </>
        )}

        {/* VIEW: TRANSACTIONS */}
        {view === 'transactions' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">History</h2>
                <button onClick={() => setShowAddModal(true)} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                    <Plus size={16}/> New
                </button>
             </div>
             <div className="flex gap-2 mb-4">
                 <div className="relative flex-1">
                     <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                     <input type="text" placeholder="Search..." className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-rose-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                 </div>
                 <input type="date" className="bg-slate-900 border border-slate-800 rounded-xl px-3 text-sm text-slate-400 focus:border-rose-500 outline-none" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
             </div>
             
             <div className="space-y-3">
                 {transactions
                 .filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()) && (filterDate ? t.date === filterDate : true))
                 .map(tx => (
                     <div key={tx.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center">
                         <div className="flex items-center gap-4">
                             <div className={`p-3 rounded-xl ${tx.type === 'Credit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                 {tx.type === 'Credit' ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}
                             </div>
                             <div>
                                 <h4 className="font-bold text-white text-sm">{tx.description || tx.category}</h4>
                                 <p className="text-xs text-slate-500">{tx.date} • {tx.category}</p>
                             </div>
                         </div>
                         <div className={`text-right font-bold ${tx.type === 'Credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {tx.type === 'Credit' ? '+' : '-'}{Number(tx.amount).toLocaleString()}
                         </div>
                     </div>
                 ))}
                 {transactions.length === 0 && <div className="text-center text-slate-500 py-10">No transactions found</div>}
             </div>
          </div>
        )}
        
        {/* VIEW: KAMETI */}
        {view === 'kameti' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-white">Kameti Manager</h2>
                        <p className="text-xs text-slate-400">Total Collected: <span className="text-emerald-400 font-bold">{formatCurrency(kametiTotalCollected)}</span></p>
                    </div>
                    <button onClick={() => setShowAddKameti(true)} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={16}/> New Kameti</button>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {kametis.map(k => (
                        <div key={k.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-white text-lg">{k.name}</h3>
                                    <p className="text-xs text-slate-500">Started: {k.startDate}</p>
                                </div>
                                <span className="bg-rose-500/10 text-rose-500 text-xs px-2 py-1 rounded-lg font-bold">Active</span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                                <div className="bg-slate-950 p-3 rounded-xl"><p className="text-xs text-slate-500">Total</p><p className="font-bold text-white">{formatCurrency(k.totalAmount)}</p></div>
                                <div className="bg-slate-950 p-3 rounded-xl"><p className="text-xs text-slate-500">Members</p><p className="font-bold text-white">{k.members}</p></div>
                                <div className="bg-slate-950 p-3 rounded-xl"><p className="text-xs text-slate-500">Per Person</p><p className="font-bold text-white">{formatCurrency(k.contribution)}</p></div>
                            </div>
                            
                            <div className="bg-slate-950 rounded-xl p-4 flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Collected So Far</p>
                                    <div className="text-xl font-bold text-emerald-400">{formatCurrency(k.collected)}</div>
                                </div>
                                <button onClick={() => handleKametiPayment(k.id, k.collected, k.contribution)} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                                    + Add Collection
                                </button>
                            </div>
                        </div>
                    ))}
                    {kametis.length === 0 && <div className="text-center text-slate-500 py-10 bg-slate-900 rounded-2xl border border-slate-800 border-dashed">No active Kametis. Start one now!</div>}
                </div>
            </div>
        )}
        
        {/* VIEW: INVESTMENTS (Placeholder for now) */}
        {view === 'investments' && (
            <div className="text-center text-slate-500 py-20">Investment Portfolio Feature Coming Soon</div>
        )}

      </main>

      {/* BOTTOM NAV (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 flex justify-around z-50 pb-8">
        <button onClick={() => setView('dashboard')} className={`${view === 'dashboard' ? 'text-rose-500' : 'text-slate-500'}`}><LayoutGrid size={24}/></button>
        <button onClick={() => setView('transactions')} className={`${view === 'transactions' ? 'text-rose-500' : 'text-slate-500'}`}><List size={24}/></button>
        <button onClick={() => setView('investments')} className={`${view === 'investments' ? 'text-rose-500' : 'text-slate-500'}`}><TrendingUp size={24}/></button>
        <button onClick={() => setView('kameti')} className={`${view === 'kameti' ? 'text-rose-500' : 'text-slate-500'}`}><Users size={24}/></button>
      </div>

      {/* MODAL: ADD TRANSACTION */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 p-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">New Transaction</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddTx} className="space-y-4">
              <div className="flex bg-slate-800 rounded-xl p-1">
                {['Expense', 'Credit'].map(t => (
                  <button key={t} type="button" onClick={() => setNewTx({...newTx, type: t})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTx.type === t ? (t === 'Credit' ? 'bg-emerald-500 text-slate-900' : 'bg-rose-500 text-white') : 'text-slate-400'}`}>{t}</button>
                ))}
              </div>
              <select className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newTx.accountId} onChange={e => setNewTx({...newTx, accountId: e.target.value})}>
                <option value="">Select Account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({Number(a.balance).toLocaleString()})</option>)}
              </select>
              <input type="number" placeholder="Amount" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none text-xl font-bold" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} />
              <input type="text" placeholder="Description" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} />
              <input type="date" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} />
              <button className="w-full bg-rose-500 text-white py-4 rounded-xl font-bold">Save Transaction</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACCOUNT */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 p-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">New Account</h3>
              <button onClick={() => setShowAddAccount(false)} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <input required placeholder="Account Name (e.g. Meezan Bank)" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} />
              <input required type="number" placeholder="Initial Balance" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newAccount.balance} onChange={e => setNewAccount({...newAccount, balance: e.target.value})} />
              <select className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value})}>
                <option>Bank</option><option>Cash</option><option>Digital Wallet</option>
              </select>
              <button className="w-full bg-rose-500 text-white py-4 rounded-xl font-bold">Create Account</button>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL: ADD KAMETI */}
      {showAddKameti && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 p-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Start Kameti</h3>
              <button onClick={() => setShowAddKameti(false)} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddKameti} className="space-y-4">
              <input required placeholder="Kameti Name (e.g. Office Group)" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newKameti.name} onChange={e => setNewKameti({...newKameti, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <input required type="number" placeholder="Total Amount" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newKameti.totalAmount} onChange={e => setNewKameti({...newKameti, totalAmount: e.target.value})} />
                  <input required type="number" placeholder="Members" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newKameti.members} onChange={e => setNewKameti({...newKameti, members: e.target.value})} />
              </div>
              <input required type="number" placeholder="Contribution Per Person" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newKameti.contribution} onChange={e => setNewKameti({...newKameti, contribution: e.target.value})} />
              <input required type="date" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-rose-500 outline-none" value={newKameti.startDate} onChange={e => setNewKameti({...newKameti, startDate: e.target.value})} />
              <button className="w-full bg-rose-500 text-white py-4 rounded-xl font-bold">Create Kameti</button>
            </form>
          </div>
        </div>
      )}
      
      {/* MODAL: ADD MONEY */}
      {showAddMoney !== null && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-800 p-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Add Balance</h3>
              <button onClick={() => setShowAddMoney(null)} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddMoney} className="space-y-4">
              <p className="text-sm text-slate-400">Adding money to: <span className="font-bold text-white">{accounts.find(a => a.id === showAddMoney)?.name}</span></p>
              <input required type="number" placeholder="Amount to Add" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl focus:border-emerald-500 outline-none font-bold text-lg" value={addMoneyAmount} onChange={e => setAddMoneyAmount(e.target.value)} />
              <button className="w-full bg-emerald-500 text-slate-900 py-4 rounded-xl font-bold">Deposit Money</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;