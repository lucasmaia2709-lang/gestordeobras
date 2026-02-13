import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { Flag, Plus, Trash, TrendUp, TrendDown, CalendarCheck } from '@phosphor-icons/react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

export const ProjectBenchmarks: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { projects } = useProjects();
    const { profile } = useAuth();

    const [isAdding, setIsAdding] = useState(false);

    // Form States
    const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [delayDays, setDelayDays] = useState(0);
    const [newDeliveryDate, setNewDeliveryDate] = useState('');
    const [notes, setNotes] = useState('');

    const project = projects.find(p => p.id === id);
    const benchmarks = project?.benchmarks || [];

    // Sort descending by month
    const sortedBenchmarks = [...benchmarks].sort((a, b) => b.month.localeCompare(a.month));

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !profile || !newDeliveryDate) return;

        const newBenchmark = {
            id: Date.now(),
            month,
            delayDays: Number(delayDays),
            newDeliveryDate,
            notes
        };

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                benchmarks: arrayUnion(newBenchmark)
            });
            setIsAdding(false);
            setNotes('');
            setDelayDays(0);
        } catch (error) {
            console.error("Error adding benchmark:", error);
            alert("Erro ao adicionar balizamento.");
        }
    };

    const handleDelete = async (item: any) => {
        if (!project || !profile || !confirm("Remover este balizamento?")) return;

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                benchmarks: arrayRemove(item)
            });
        } catch (error) {
            console.error("Error deleting benchmark:", error);
            alert("Erro ao remover balizamento.");
        }
    };

    if (!project) return <div className="p-8">Carregando...</div>;

    const isMasterOrUser = profile?.role === 'master' || profile?.role === 'user';

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Balizamentos</h1>
                    <p className="text-sm text-gray-400">Controle de Prazos e Metas</p>
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
                <form onSubmit={handleAdd} className="mb-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 fade-in space-y-4">
                    <h3 className="font-bold text-gray-800">Novo Balizamento</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase">Mês de Referência</label>
                            <input
                                type="month"
                                required
                                className="w-full bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-ios-blue"
                                value={month}
                                onChange={e => setMonth(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase">Dias de Desvio (+ Atraso / - Adiantado)</label>
                            <input
                                type="number"
                                required
                                className="w-full bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-ios-blue"
                                value={delayDays}
                                onChange={e => setDelayDays(Number(e.target.value))}
                            />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Nova Previsão de Entrega</label>
                            <input
                                type="date"
                                required
                                className="w-full bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-ios-blue"
                                value={newDeliveryDate}
                                onChange={e => setNewDeliveryDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Observações</label>
                            <textarea
                                className="w-full bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-ios-blue resize-none h-24"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Motivo do atraso/adiantamento..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
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
                            Salvar
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="space-y-4">
                {sortedBenchmarks.length === 0 && !isAdding && (
                    <div className="text-center py-12 text-gray-400">
                        <Flag size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Nenhum balizamento registrado</p>
                    </div>
                )}

                {sortedBenchmarks.map((item) => (
                    <div key={item.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group overflow-hidden">
                        {/* Status Bar Indicator */}
                        <div className={clsx(
                            "absolute left-0 top-0 bottom-0 w-1.5",
                            item.delayDays > 0 ? "bg-red-500" : item.delayDays < 0 ? "bg-green-500" : "bg-gray-300"
                        )}></div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pl-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-gray-900 capitalize">
                                        {format(parseISO(`${item.month}-01`), 'MMMM yyyy', { locale: pt })}
                                    </span>
                                    {isMasterOrUser && (
                                        <button onClick={() => handleDelete(item)} className="text-gray-300 hover:text-red-500 transition-colors">
                                            <Trash size={16} />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                        <CalendarCheck weight="bold" />
                                        <span>Entrega: {format(parseISO(item.newDeliveryDate), 'dd/MM/yyyy')}</span>
                                    </div>
                                </div>
                                {item.notes && (
                                    <p className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded-lg inline-block">
                                        {item.notes}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {item.delayDays !== 0 ? (
                                    <div className={clsx(
                                        "px-4 py-2 rounded-xl font-bold flex items-center gap-2",
                                        item.delayDays > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                                    )}>
                                        {item.delayDays > 0 ? <TrendDown weight="bold" size={20} /> : <TrendUp weight="bold" size={20} />}
                                        <div className="flex flex-col items-end leading-tight">
                                            <span className="text-lg">{Math.abs(item.delayDays)} dias</span>
                                            <span className="text-[10px] uppercase opacity-70">
                                                {item.delayDays > 0 ? 'Atraso' : 'Adiantamento'}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 rounded-xl font-bold bg-gray-100 text-gray-500">
                                        No Prazo
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
