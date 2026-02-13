import React, { useState, useEffect } from 'react';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../hooks/useProjects';
import { Users, Plus, Trash, CheckCircle } from '@phosphor-icons/react';
import clsx from 'clsx';

interface TeamMember {
    email: string;
    role: 'master' | 'user' | 'client';
    allowedProjects?: string[];
    createdAt: string;
    masterUid?: string;
}

export const TeamManagement: React.FC = () => {
    const { profile } = useAuth();
    const { projects } = useProjects();

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Form
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'user' | 'client'>('user');
    const [allowedProjects, setAllowedProjects] = useState<string[]>([]);

    useEffect(() => {
        if (!profile || profile.role !== 'master') return;
        fetchMembers();
    }, [profile]);

    const fetchMembers = async () => {
        try {
            // We search in 'permissions' collection where masterUid == profile.uid
            // Note: This requires an index. If not, we can client-side filter if small.
            // But 'permissions' logic in AuthContext uses email as ID. 
            // To list them, we might need to store them in a subcollection OR query 'permissions' where masterUid == me.

            const q = query(
                collection(db, 'permissions'),
                where('masterUid', '==', profile?.uid)
            );

            const querySnapshot = await getDocs(q);
            const loadedMembers: TeamMember[] = [];
            querySnapshot.forEach((doc) => {
                loadedMembers.push({ email: doc.id, ...doc.data() } as TeamMember);
            });
            setMembers(loadedMembers);
        } catch (error) {
            console.error("Error fetching members:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !email) return;

        try {
            const memberData: TeamMember = {
                email: email.toLowerCase().trim(),
                role,
                masterUid: profile.uid, // Link to this master
                allowedProjects: allowedProjects,
                createdAt: new Date().toISOString()
            };

            // @ts-ignore
            await setDoc(doc(db, 'permissions', memberData.email), memberData);

            alert(`Usuário ${email} adicionado com sucesso!`);
            setEmail('');
            setAllowedProjects([]);
            setIsAdding(false);
            fetchMembers();
        } catch (error) {
            console.error("Error adding member:", error);
            alert("Erro ao adicionar usuário.");
        }
    };

    const handleDelete = async (memberEmail: string) => {
        if (!confirm(`Remover acesso de ${memberEmail}?`)) return;
        try {
            await deleteDoc(doc(db, 'permissions', memberEmail));
            fetchMembers();
        } catch (error) {
            alert("Erro ao remover usuário.");
        }
    };

    const toggleProject = (projectId: string) => {
        setAllowedProjects(prev =>
            prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId]
        );
    };

    if (profile?.role !== 'master') return <div className="p-8">Acesso restrito a Masters.</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestão de Equipe</h1>
                    <p className="text-sm text-gray-400">Controle de acessos e permissões</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-ios-blue text-gray-900 px-4 py-2 rounded-full shadow-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 font-bold"
                >
                    <Plus size={20} weight="bold" />
                    <span>Novo Usuário</span>
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleAddMember} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8 fade-in">
                    <h3 className="font-bold text-gray-800 mb-4">Adicionar Membro</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Email do Usuário (Google Login)</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-ios-blue"
                                placeholder="exemplo@gmail.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Função</label>
                            <div className="flex gap-4 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setRole('user')}
                                    className={clsx(
                                        "flex-1 p-3 rounded-xl border transition-all text-sm font-bold",
                                        role === 'user' ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-200 text-gray-500"
                                    )}
                                >
                                    Usuário (Equipe)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('client')}
                                    className={clsx(
                                        "flex-1 p-3 rounded-xl border transition-all text-sm font-bold",
                                        role === 'client' ? "bg-purple-50 border-purple-200 text-purple-600" : "bg-white border-gray-200 text-gray-500"
                                    )}
                                >
                                    Cliente (Visualizador)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Obras Permitidas</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                                {projects.map(updatesProject => (
                                    <div
                                        key={updatesProject.id}
                                        onClick={() => toggleProject(updatesProject.id)}
                                        className={clsx(
                                            "p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all",
                                            allowedProjects.includes(updatesProject.id)
                                                ? "bg-green-50 border-green-200"
                                                : "bg-white border-gray-100 hover:bg-gray-50"
                                        )}
                                    >
                                        <div className={clsx(
                                            "w-5 h-5 rounded-full border flex items-center justify-center",
                                            allowedProjects.includes(updatesProject.id)
                                                ? "bg-green-500 border-green-500 text-white"
                                                : "border-gray-300"
                                        )}>
                                            {allowedProjects.includes(updatesProject.id) && <CheckCircle weight="fill" size={12} />}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{updatesProject.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-ios-blue text-gray-900 font-bold rounded-lg"
                        >
                            Salvar Permissão
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="space-y-4">
                {members.length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-400">
                        <Users size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Nenhum membro na equipe.</p>
                    </div>
                )}

                {members.map(member => (
                    <div key={member.email} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center font-bold">
                                {member.email[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">{member.email}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={clsx(
                                        "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full",
                                        member.role === 'user' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                    )}>
                                        {member.role === 'user' ? 'Equipe' : 'Cliente'}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        • {member.allowedProjects?.length || 0} obras permitidas
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => handleDelete(member.email)}
                            className="text-gray-300 hover:text-red-500 p-2 transition-colors self-end md:self-center"
                        >
                            <Trash size={20} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
