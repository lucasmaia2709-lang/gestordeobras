import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash, FloppyDisk } from '@phosphor-icons/react';
import type { FinancialRecord } from '../types';
import clsx from 'clsx';

export const ProjectFinancial: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { projects } = useProjects();
    const { profile } = useAuth();

    // Local state for editing to avoid constant firestore writes
    const [editingRecords, setEditingRecords] = useState<FinancialRecord[] | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    const project = projects.find(p => p.id === id);

    // Initialize local state when project loads
    if (project && !editingRecords && !isDirty) {
        // Sort by month
        const sorted = [...(project.financial || [])].sort((a, b) => a.month.localeCompare(b.month));
        setEditingRecords(sorted);
    }

    const records = editingRecords || [];

    const handleSave = async () => {
        if (!project || !profile || !editingRecords) return;

        try {
            await updateDoc(doc(db, `users/${profile.masterUid}/projects/${project.id}`), {
                financial: editingRecords
            });
            setIsDirty(false);
            alert("Dados financeiros salvos!");
        } catch (error) {
            console.error("Error saving financial:", error);
            alert("Erro ao salvar dados.");
        }
    };

    const updateRecord = (index: number, field: keyof FinancialRecord, value: any) => {
        if (!editingRecords) return;
        const newRecords = [...editingRecords];
        newRecords[index] = { ...newRecords[index], [field]: value };
        setEditingRecords(newRecords);
        setIsDirty(true);
    };

    const addRecord = () => {
        if (!editingRecords) return;
        const newRecord: FinancialRecord = {
            id: Date.now(),
            month: new Date().toISOString().slice(0, 7), // YYYY-MM
            planned: 0,
            measured: 0
        };
        setEditingRecords([...editingRecords, newRecord]);
        setIsDirty(true);
    };

    const removeRecord = (index: number) => {
        if (!editingRecords || !confirm("Remover este registro?")) return;
        const newRecords = [...editingRecords];
        newRecords.splice(index, 1);
        setEditingRecords(newRecords);
        setIsDirty(true);
    };

    // Summary calculations
    const sortedRecords = [...records].sort((a, b) => a.month.localeCompare(b.month));

    // Find last month with measured value > 0 (Reverse search)
    let currentRecord = [...sortedRecords].reverse().find(r => (r.measured || 0) > 0);

    // Fallback to latest record if none have measured > 0 or if there are no records
    if (!currentRecord && sortedRecords.length > 0) {
        currentRecord = sortedRecords[sortedRecords.length - 1];
    }

    let accPlannedVal = 0;
    let accMeasuredVal = 0;
    if (currentRecord) {
        sortedRecords.forEach(r => {
            if (r.month <= currentRecord.month) {
                accPlannedVal += Number(r.planned || 0);
                accMeasuredVal += Number(r.measured || 0);
            }
        });
    }

    const [showTable, setShowTable] = useState(false);

    if (!project) return <div className="p-8">Carregando...</div>;

    const totalPlanned = records.reduce((acc: number, curr: FinancialRecord) => acc + Number(curr.planned || 0), 0);
    const totalMeasured = records.reduce((acc: number, curr: FinancialRecord) => acc + Number(curr.measured || 0), 0);
    const isMaster = profile?.role === 'master';
    const canEdit = isMaster; // Only master can edit financials usually

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Financeiro</h1>
                    <p className="text-sm text-gray-400">Controle de custos e medidos</p>
                </div>
                {canEdit && (
                    <div className="flex gap-2">
                        {isDirty && (
                            <button
                                onClick={handleSave}
                                className="bg-ios-green text-white px-4 py-2 rounded-full shadow-lg hover:bg-green-600 transition-colors flex items-center gap-2 font-bold"
                            >
                                <FloppyDisk size={20} weight="bold" />
                                <span className="hidden md:inline">Salvar</span>
                            </button>
                        )}
                        <button
                            onClick={addRecord}
                            className="bg-ios-blue text-gray-900 p-2 rounded-full shadow-lg hover:bg-yellow-500 transition-colors"
                        >
                            <Plus size={24} weight="bold" />
                        </button>
                    </div>
                )}
            </div>

            {/* Global Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase">Total Previsto</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalPlanned)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase">Total Realizado</p>
                    <p className="text-2xl font-bold text-ios-green mt-1">{formatCurrency(totalMeasured)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase">Saldo</p>
                    <p className={clsx(
                        "text-2xl font-bold mt-1",
                        (totalPlanned - totalMeasured) >= 0 ? "text-gray-900" : "text-red-500"
                    )}>
                        {formatCurrency(totalPlanned - totalMeasured)}
                    </p>
                </div>
            </div>

            {/* Monthly Summary Cards (Last Entry with Measurement) */}
            <div className="md:grid md:grid-cols-2 gap-4 mb-8 space-y-4 md:space-y-0">
                <div className="md:col-span-2">
                    <h2 className="text-white font-bold ml-1 mb-2">
                        Última Medição {currentRecord && `(${currentRecord.month})`}
                    </h2>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase">Faturamento Previsto</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                        {currentRecord ? formatCurrency(currentRecord.planned || 0) : '€ 0,00'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase">Realizado</p>
                    <p className="text-xl font-bold text-ios-green mt-1">
                        {currentRecord ? formatCurrency(currentRecord.measured || 0) : '€ 0,00'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase">Acumulado Previsto</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                        {formatCurrency(accPlannedVal)}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase">Acumulado Real</p>
                    <p className="text-xl font-bold text-ios-blue mt-1">
                        {formatCurrency(accMeasuredVal)}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className={clsx(
                "bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300",
                !showTable && "hidden md:block" // Hidden on mobile unless toggled
            )}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-bold">
                                <th className="p-4 whitespace-nowrap min-w-[150px]">Mês</th>
                                <th className="p-4 whitespace-nowrap min-w-[150px]">Previsto (€)</th>
                                <th className="p-4 whitespace-nowrap min-w-[150px]">Realizado (€)</th>
                                <th className="p-4 whitespace-nowrap min-w-[150px]">Acum. Prev. (€)</th>
                                <th className="p-4 whitespace-nowrap min-w-[150px]">Acum. Real. (€)</th>
                                <th className="p-4 whitespace-nowrap min-w-[150px]">Desvio (€)</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {(() => {
                                let accPlanned = 0;
                                let accMeasured = 0;

                                return sortedRecords.map((record: FinancialRecord, index: number) => {
                                    accPlanned += record.planned || 0;
                                    accMeasured += record.measured || 0;
                                    const deviation = (record.measured || 0) - (record.planned || 0);

                                    return (
                                        <tr key={record.id || index} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                <input
                                                    type="month"
                                                    value={record.month}
                                                    onChange={(e) => updateRecord(index, 'month', e.target.value)}
                                                    disabled={!canEdit}
                                                    className="bg-transparent outline-none font-medium text-gray-900 w-full"
                                                />
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1 group focus-within:ring-2 focus-within:ring-blue-100 rounded-lg p-1 -ml-1 transition-all">
                                                    <span className="text-gray-400 text-sm">€</span>
                                                    <input
                                                        type="number"
                                                        value={record.planned}
                                                        onChange={(e) => updateRecord(index, 'planned', parseFloat(e.target.value))}
                                                        disabled={!canEdit}
                                                        className="bg-transparent outline-none font-medium text-gray-900 w-full"
                                                        placeholder="0,00"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1 group focus-within:ring-2 focus-within:ring-green-100 rounded-lg p-1 -ml-1 transition-all">
                                                    <span className="text-gray-400 text-sm">€</span>
                                                    <input
                                                        type="number"
                                                        value={record.measured}
                                                        onChange={(e) => updateRecord(index, 'measured', parseFloat(e.target.value))}
                                                        disabled={!canEdit}
                                                        className="bg-transparent outline-none font-bold text-ios-green w-full"
                                                        placeholder="0,00"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-gray-500 text-sm">
                                                {formatCurrency(accPlanned)}
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-gray-500 text-sm">
                                                {formatCurrency(accMeasured)}
                                            </td>
                                            <td className={clsx("p-4 whitespace-nowrap text-sm font-bold", deviation > 0 ? "text-green-500" : deviation < 0 ? "text-red-500" : "text-gray-400")}>
                                                {deviation === 0 ? '-' : formatCurrency(deviation)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {canEdit && (
                                                    <button
                                                        onClick={() => removeRecord(index)}
                                                        className="text-gray-300 hover:text-red-500 transition-colors p-2"
                                                    >
                                                        <Trash size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-400">
                                        Nenhum registro financeiro.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Toggle Button */}
            <div className="md:hidden mt-6 flex justify-center">
                <button
                    onClick={() => setShowTable(!showTable)}
                    className="bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/20 font-bold shadow-lg transition-all active:scale-95"
                >
                    {showTable ? 'Esconder Tabela' : 'Ver Tabela Completa'}
                </button>
            </div>
        </div>
    );
};
