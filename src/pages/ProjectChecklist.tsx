import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { CheckSquare, Plus, Trash, Check, CaretDown, CaretRight } from '@phosphor-icons/react';
import clsx from 'clsx';
// import type { Project } from '../types'; 

export const ProjectChecklist: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { projects } = useProjects();
    const { profile } = useAuth();

    const [newItemText, setNewItemText] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);

    const project = projects.find(p => p.id === id);
    const checklist = project?.checklist || [];

    const pendingItems = checklist.filter(item => !item.completed);
    const completedItems = checklist.filter(item => item.completed);

    const handleToggle = async (item: any) => {
        if (!project || !profile || profile.role === 'client') return;

        const updatedChecklist = checklist.map(i =>
            i.id === item.id ? { ...i, completed: !i.completed } : i
        );

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                checklist: updatedChecklist
            });
        } catch (error) {
            console.error("Error toggling item:", error);
            alert("Erro ao atualizar item.");
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemText.trim() || !project || !profile) return;

        const newItem = {
            id: Date.now(),
            text: newItemText.trim(),
            completed: false
        };

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                checklist: arrayUnion(newItem)
            });
            setNewItemText('');
            setIsAdding(false);
        } catch (error) {
            console.error("Error adding item:", error);
            alert("Erro ao adicionar item.");
        }
    };

    const handleDelete = async (item: any) => {
        if (!project || !profile || !confirm("Remover este item?")) return;

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                checklist: arrayRemove(item)
            });
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Erro ao remover item.");
        }
    };

    if (!project) return <div className="p-8">Carregando...</div>;

    const isMasterOrUser = profile?.role === 'master' || profile?.role === 'user';

    const renderItem = (item: any) => (
        <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm group">
            <div className="flex items-center gap-3 flex-1">
                <button
                    onClick={() => handleToggle(item)}
                    className={clsx(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        item.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-ios-blue"
                    )}
                >
                    {item.completed && <Check size={14} weight="bold" />}
                </button>
                <span className={clsx(
                    "text-gray-700 font-medium transition-all",
                    item.completed && "text-gray-400 line-through"
                )}>
                    {item.text}
                </span>
            </div>
            {isMasterOrUser && (
                <button onClick={() => handleDelete(item)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash size={18} />
                </button>
            )}
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Checklist</h1>
                    <p className="text-sm text-gray-400">Acompanhe as etapas da obra</p>
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
                <form onSubmit={handleAddItem} className="mb-8 flex gap-2 fade-in">
                    <input
                        type="text"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="Nova etapa..."
                        className="flex-1 bg-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-ios-blue shadow-sm"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!newItemText.trim()}
                        className="px-6 py-2 bg-ios-blue text-gray-900 font-bold rounded-lg disabled:opacity-50 shadow-lg hover:bg-yellow-500 transition-colors"
                    >
                        Adicionar
                    </button>
                </form>
            )}

            {/* Pending Items */}
            <div className="space-y-3">
                {pendingItems.length === 0 && completedItems.length === 0 && !isAdding && (
                    <div className="text-center py-12 text-gray-400 opacity-50">
                        <CheckSquare size={48} className="mx-auto mb-2" />
                        <p>Nenhuma etapa cadastrada</p>
                    </div>
                )}

                {pendingItems.map(renderItem)}
            </div>

            {/* Completed Items Section */}
            {completedItems.length > 0 && (
                <div className="mt-8">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider hover:text-gray-700 transition-colors"
                    >
                        {showCompleted ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
                        Concluídos ({completedItems.length})
                    </button>

                    {showCompleted && (
                        <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity fade-in">
                            {completedItems.map(renderItem)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

