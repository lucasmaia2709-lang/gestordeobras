import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../hooks/useProjects';
import type { DailyLog as DailyLogType, WorkforceItem } from '../types';
import { CaretLeft, CloudSun, Users, Check, Plus, Trash, Camera, Spinner, Copy, PencilSimple } from '@phosphor-icons/react';
import clsx from 'clsx';
import { format, parseISO, subDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PhotoUpload } from '../components/shared/PhotoUpload';

const WEATHER_OPTIONS = ['sol', 'nublado', 'chuvisco', 'chuva'];

const createEmptyLog = (): DailyLogType => ({
    weatherMorning: 'sol',
    weatherAfternoon: 'sol',
    temperature: '',
    workforce: [],
    events: '',
    materials: [],
    photos: [],
    eventPhotos: [],
    materialPhotos: [],
    meeting: { hasMeeting: false }
});

export const DailyLog: React.FC = () => {
    const { id, date } = useParams<{ id: string; date: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { projects } = useProjects();

    const [log, setLog] = useState<DailyLogType>(createEmptyLog());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const project = projects.find(p => p.id === id);
    const companies = project?.companies || [];

    useEffect(() => {
        if (!id || !date || !profile) return;

        const loadLog = async () => {
            try {
                const docRef = doc(db, `users/${profile.masterUid}/projects/${id}/dailyLogs/${date}`);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    setLog(snap.data() as DailyLogType);
                    setIsEditing(false); // Valid log exists, start in view mode
                } else {
                    setLog(createEmptyLog());
                    // New log, start in edit mode only if not client
                    if (profile.role !== 'client') {
                        setIsEditing(true);
                    }
                }
            } catch (error) {
                console.error("Error loading log:", error);
            } finally {
                setLoading(false);
            }
        };

        loadLog();
    }, [id, date, profile]);

    const handleSave = async () => {
        if (!id || !date || !profile) return;
        setSaving(true);
        try {
            const docRef = doc(db, `users/${profile.masterUid}/projects/${id}/dailyLogs/${date}`);
            await setDoc(docRef, log, { merge: true });
            alert("Salvo com sucesso!");
            setIsEditing(false); // Return to view mode
        } catch (error) {
            alert("Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    const updateLog = (field: keyof DailyLogType, value: any) => {
        setLog(prev => ({ ...prev, [field]: value }));
    };

    // Workforce Helpers
    const addWorkforce = () => {
        const newItem: WorkforceItem = { company: '', role: '', count: 1 };
        updateLog('workforce', [...log.workforce, newItem]);
    };

    const removeWorkforce = (index: number) => {
        const newWorkforce = [...log.workforce];
        newWorkforce.splice(index, 1);
        updateLog('workforce', newWorkforce);
    };

    const updateWorkforceItem = (index: number, field: keyof WorkforceItem, value: any) => {
        const newWorkforce = [...log.workforce];
        newWorkforce[index] = { ...newWorkforce[index], [field]: value };
        updateLog('workforce', newWorkforce);
    };

    const copyPreviousWorkforce = async () => {
        if (!id || !date || !profile) return;

        if (!confirm("Isso irá substituir o efetivo atual pelo último efetivo lançado. Continuar?")) return;

        try {
            // Query last 30 days logic (unchanged)
            const currentDay = parseISO(date);
            let foundLog: DailyLogType | null = null;
            let foundDate = "";

            for (let i = 1; i <= 30; i++) {
                const prevDate = subDays(currentDay, i);
                const prevDateStr = format(prevDate, 'yyyy-MM-dd');

                const dayRef = doc(db, `users/${profile.masterUid}/projects/${id}/dailyLogs/${prevDateStr}`);
                const snap = await getDoc(dayRef);

                if (snap.exists()) {
                    const data = snap.data() as DailyLogType;
                    if (data.workforce && data.workforce.length > 0) {
                        foundLog = data;
                        foundDate = prevDateStr;
                        break;
                    }
                }
            }

            if (foundLog && foundLog.workforce) {
                updateLog('workforce', foundLog.workforce);
                alert(`Efetivo copiado do dia ${format(parseISO(foundDate), 'dd/MM/yyyy')}.`);
            } else {
                alert("Não foi encontrado nenhum efetivo nos últimos 30 dias.");
            }
        } catch (error) {
            console.error("Error copying workforce:", error);
            // @ts-ignore
            alert(`Erro ao copiar efetivo: ${error.message || error}`);
        }
    };

    if (loading) return <div className="p-8"><Spinner className="animate-spin mx-auto" size={32} /></div>;

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 hover:text-gray-600">
                    <CaretLeft size={24} weight="bold" />
                </button>
                <div className="text-center">
                    <h2 className="font-bold text-lg text-gray-900">
                        {date && format(parseISO(date), "d 'de' MMMM", { locale: pt })}
                    </h2>
                    <p className="text-xs text-gray-500 uppercase font-bold">Diário de Obra</p>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="space-y-6">
                {/* Weather Section */}
                <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4 text-orange-500 font-bold">
                        <CloudSun size={24} weight="fill" />
                        <span>Clima</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {['weatherMorning', 'weatherAfternoon'].map((period) => (
                            <div key={period} className="space-y-2">
                                <span className="text-[10px] uppercase font-bold text-gray-400">
                                    {period === 'weatherMorning' ? 'Manhã' : 'Tarde'}
                                </span>
                                <div className="flex gap-2 overflow-x-auto pb-2 noscroll">
                                    {WEATHER_OPTIONS.map(opt => (
                                        <button
                                            key={opt}
                                            disabled={!isEditing}
                                            onClick={() => updateLog(period as keyof DailyLogType, opt)}
                                            className={clsx(
                                                "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all border",
                                                // @ts-ignore
                                                log[period] === opt
                                                    ? "bg-ios-blue text-gray-900 border-ios-blue shadow-md shadow-yellow-200"
                                                    : "bg-white text-gray-600 border-gray-100 hover:bg-gray-50"
                                            )}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Workforce Section */}
                <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-purple-600 font-bold">
                            <Users size={24} weight="fill" />
                            <span>Efetivo</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditing && (
                                <button
                                    onClick={copyPreviousWorkforce}
                                    className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 flex items-center gap-1 transition-colors"
                                    title="Copiar efetivo do dia anterior"
                                >
                                    <Copy size={16} />
                                    Copiar Anterior
                                </button>
                            )}
                            <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">
                                Total: {log.workforce.reduce((acc, curr) => acc + Number(curr.count || 0), 0)}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {log.workforce.map((item, index) => (
                            <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="flex-1 w-full space-y-1">
                                    <input
                                        placeholder="Função (ex: Pedreiro)"
                                        className="w-full bg-transparent text-sm font-bold text-gray-800 outline-none placeholder:font-normal"
                                        value={item.role}
                                        onChange={e => updateWorkforceItem(index, 'role', e.target.value)}
                                        disabled={!isEditing}
                                    />

                                    <select
                                        className="w-full bg-transparent text-xs text-gray-500 outline-none -ml-1 py-1"
                                        value={item.company}
                                        onChange={e => updateWorkforceItem(index, 'company', e.target.value)}
                                        disabled={!isEditing}
                                    >
                                        <option value="" disabled>Selecione a empresa</option>
                                        <option value="Própria">Equipe Própria</option>
                                        {companies.map(comp => (
                                            <option key={comp.id} value={comp.name}>{comp.name}</option>
                                        ))}
                                        {item.company && item.company !== 'Própria' && !companies.find(c => c.name === item.company) && (
                                            <option value={item.company}>{item.company}</option>
                                        )}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <input
                                        type="number"
                                        className="w-full md:w-16 text-center bg-white border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500"
                                        value={item.count}
                                        onChange={e => updateWorkforceItem(index, 'count', e.target.value)}
                                        disabled={!isEditing}
                                    />
                                    {isEditing && (
                                        <button onClick={() => removeWorkforce(index)} className="p-2 text-red-400 hover:text-red-600">
                                            <Trash size={18} weight="bold" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isEditing && (
                            <button
                                onClick={addWorkforce}
                                className="w-full py-3 border-2 border-dashed border-purple-100 text-purple-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                            >
                                <Plus size={18} weight="bold" />
                                Adicionar Equipe
                            </button>
                        )}
                    </div>
                </section>

                {/* Events/Notes */}
                <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4">Ocorrências / Observações</h3>
                    <textarea
                        className="w-full bg-gray-50 border-0 rounded-xl p-4 text-sm text-gray-700 focus:ring-2 focus:ring-ios-blue outline-none resize-none h-32"
                        placeholder="Descreva as atividades do dia..."
                        value={log.events}
                        onChange={e => updateLog('events', e.target.value)}
                        disabled={!isEditing}
                    />
                </section>


                {/* Photos */}
                <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4 text-blue-500 font-bold">
                        <Camera size={24} weight="fill" />
                        <span>Galeria de Fotos</span>
                    </div>
                    <PhotoUpload
                        photos={[...log.photos, ...log.eventPhotos, ...log.materialPhotos]}
                        path={`users/${profile?.masterUid}/projects/${id}/photos`}
                        isEditing={isEditing}
                        onUpdate={(newPhotos) => updateLog('photos', newPhotos)}
                    />
                </section>

                {/* Floating Action Button: Edit or Save */}
                {profile?.role !== 'client' && (
                    <div className="fixed bottom-6 right-6 md:static md:mt-6">
                        {isEditing ? (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-ios-green text-white px-6 py-3 rounded-full md:rounded-xl font-bold shadow-lg shadow-green-200 flex items-center gap-2 hover:bg-green-600 transition-transform active:scale-95 w-full md:w-auto justify-center"
                            >
                                {saving ? <Spinner className="animate-spin" /> : <Check size={20} weight="bold" />}
                                <span>Salvar Diário</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="bg-ios-blue text-gray-900 px-6 py-3 rounded-full md:rounded-xl font-bold shadow-lg shadow-yellow-200 flex items-center gap-2 hover:bg-yellow-400 transition-transform active:scale-95 w-full md:w-auto justify-center"
                            >
                                <PencilSimple size={20} weight="bold" />
                                <span>Editar Diário</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
