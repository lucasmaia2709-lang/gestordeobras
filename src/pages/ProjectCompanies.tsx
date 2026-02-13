import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { Buildings, Plus, Trash, Phone, Envelope } from '@phosphor-icons/react';
// import { Project } from '../types'; 

// Temporary interface until we update types if needed, 
// strictly speaking 'companies' in Project type is { id: number; name: string }[] 
// but we might want to add more details later. For now we stick to the type.

export const ProjectCompanies: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { projects } = useProjects();
    const { profile } = useAuth();

    const [newCompanyName, setNewCompanyName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const project = projects.find(p => p.id === id);
    const companies = project?.companies || [];

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCompanyName.trim() || !project || !profile) return;

        const newCompany = {
            id: Date.now(),
            name: newCompanyName.trim()
        };

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                companies: arrayUnion(newCompany)
            });
            setNewCompanyName('');
            setIsAdding(false);
        } catch (error) {
            console.error("Error adding company:", error);
            alert("Erro ao adicionar empresa.");
        }
    };

    const handleDelete = async (company: any) => {
        if (!project || !profile || !confirm(`Remover ${company.name}?`)) return;

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                companies: arrayRemove(company)
            });
        } catch (error) {
            console.error("Error deleting company:", error);
            alert("Erro ao remover empresa.");
        }
    };

    if (!project) return <div className="p-8">Carregando...</div>;

    const isMasterOrUser = profile?.role === 'master' || profile?.role === 'user';

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Cadastros</h1>
                    <p className="text-sm text-gray-400">Fornecedores e Parceiros</p>
                </div>
                {isMasterOrUser && (
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="bg-ios-blue text-gray-900 p-2 rounded-full shadow-lg hover:bg-yellow-500 transition-colors"
                    >
                        <Plus size={24} weight="bold" />
                    </button>
                )}
            </div>

            {/* Add Form */}
            {isAdding && (
                <form onSubmit={handleAdd} className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 fade-in">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Nome da Empresa / Fornecedor"
                        className="w-full bg-transparent text-lg font-medium outline-none mb-4"
                        value={newCompanyName}
                        onChange={e => setNewCompanyName(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!newCompanyName.trim()}
                            className="px-6 py-2 bg-ios-blue text-gray-900 font-bold rounded-lg disabled:opacity-50"
                        >
                            Adicionar
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {companies.length === 0 && !isAdding && (
                    <div className="text-center py-12 text-gray-400">
                        <Buildings size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Nenhuma empresa cadastrada</p>
                    </div>
                )}

                {companies.map((company) => (
                    <div
                        key={company.id}
                        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-100 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                                <Buildings size={20} weight="fill" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">{company.name}</h3>
                                <p className="text-xs text-gray-400">Fornecedor / Parceiro</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Placeholder actions for future contacts */}
                            <button className="p-2 text-gray-300 hover:text-blue-500 transition-colors" title="Ligar (Demo)">
                                <Phone size={20} />
                            </button>
                            <button className="p-2 text-gray-300 hover:text-blue-500 transition-colors" title="Email (Demo)">
                                <Envelope size={20} />
                            </button>

                            {isMasterOrUser && (
                                <button
                                    onClick={() => handleDelete(company)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors ml-2"
                                >
                                    <Trash size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
