import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { HardHat, Spinner, Envelope, Lock, WarningCircle } from '@phosphor-icons/react';

export const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                // Register Check
                const permRef = doc(db, 'permissions', email);
                const permSnap = await getDoc(permRef);

                if (!permSnap.exists()) {
                    throw new Error("Este email não tem autorização para se cadastrar. Peça ao Master.");
                }
                await createUserWithEmailAndPassword(auth, email, password);
            }
            navigate('/');
        } catch (err: any) {
            let msg = err.message;
            if (msg.includes('auth/invalid-credential')) msg = "Email ou senha incorretos.";
            if (msg.includes('auth/email-already-in-use')) msg = "Email já cadastrado.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in border border-gray-100">

                {/* Header */}
                <div className="bg-ios-blue p-8 flex flex-col items-center justify-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent"></div>
                    <div className="bg-white/20 p-4 rounded-2xl mb-3 backdrop-blur-sm">
                        <HardHat size={48} weight="fill" className="drop-shadow-md" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">ObraApp</h1>
                    <p className="text-blue-100 text-sm font-medium">Gestão Inteligente de Obras</p>
                </div>

                {/* Form */}
                <div className="p-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
                        {isLogin ? 'Bem-vindo de volta' : 'Criar Conta'}
                    </h2>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email</label>
                            <div className="relative">
                                <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-ios-blue/50 focus:border-ios-blue transition-all"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-ios-blue/50 focus:border-ios-blue transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-500 text-sm p-3 rounded-xl flex items-center gap-2 animate-fade-in">
                                <WarningCircle size={20} weight="bold" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-ios-blue hover:bg-yellow-500 text-gray-900 font-bold py-3.5 rounded-xl shadow-lg shadow-yellow-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center"
                        >
                            {loading ? <Spinner className="animate-spin" size={24} /> : (isLogin ? 'Entrar' : 'Criar Conta')}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-ios-blue font-semibold text-sm hover:underline"
                        >
                            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
