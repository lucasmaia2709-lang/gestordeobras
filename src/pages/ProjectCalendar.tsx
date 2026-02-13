import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useDailyLogs } from '../hooks/useDailyLogs';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isSameMonth,
    isToday,
    parseISO
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { CaretLeft, CaretRight, FileText, TrendUp, TrendDown } from '@phosphor-icons/react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

export const ProjectCalendar: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { projects } = useProjects();
    const { logs } = useDailyLogs(id);
    const { profile } = useAuth();

    const [currentDate, setCurrentDate] = useState(new Date());

    const project = projects.find(p => p.id === id);

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentDate));
        const end = endOfWeek(endOfMonth(currentDate));
        return eachDayOfInterval({ start, end });
    }, [currentDate]);



    if (!project) return <div className="p-8">Obra não encontrada.</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
            {/* Header Info */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center md:text-left">
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">{project.client}</p>

                {/* Latest Benchmark Display */}
                {(() => {
                    // Filter and sort benchmarks to find the latest
                    const benchmarks = project.benchmarks || [];
                    const latest = [...benchmarks].sort((a, b) => b.month.localeCompare(a.month))[0];

                    if (!latest) return null;

                    return (
                        <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center md:flex-row md:justify-between gap-4">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">Último Balizamento ({format(parseISO(`${latest.month}-01`), 'MMM yyyy', { locale: pt })})</h3>
                                <div className="flex items-center justify-center md:justify-start gap-2">
                                    <div className={clsx(
                                        "px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2",
                                        latest.delayDays > 0 ? "bg-red-100 text-red-600" :
                                            latest.delayDays < 0 ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-600"
                                    )}>
                                        {latest.delayDays > 0 ? <TrendDown weight="bold" /> : latest.delayDays < 0 ? <TrendUp weight="bold" /> : <div className="w-4" />}
                                        <span>
                                            {latest.delayDays === 0 ? "No Prazo" : `${Math.abs(latest.delayDays)} dias ${latest.delayDays > 0 ? 'atraso' : 'adiantamento'}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center md:text-right">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Previsão de Entrega</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {format(parseISO(latest.newDeliveryDate), 'dd/MM/yyyy')}
                                </p>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Calendar Grid */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <CaretLeft size={24} />
                    </button>
                    <h2 className="text-lg font-bold capitalize text-gray-800">
                        {format(currentDate, 'MMMM yyyy', { locale: pt })}
                    </h2>
                    <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <CaretRight size={24} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                        <div key={index} className="text-xs font-bold text-gray-300 uppercase py-2">{day}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-2">
                    {days.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const log = logs[dayKey];
                        const hasContent = log && (log.workforce?.length > 0 || log.events || log.materials?.length > 0);
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isTodayDate = isToday(day);

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => navigate(`/project/${id}/daily/${dayKey}`)} // Need to create route
                                className={clsx(
                                    "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all active:scale-95",
                                    !isCurrentMonth ? "opacity-30" : "hover:bg-gray-50",
                                    isTodayDate ? "ring-2 ring-ios-blue text-gray-900 font-bold" : "text-gray-700",
                                    "border border-transparent"
                                )}
                            >
                                <span className="text-sm">{format(day, 'd')}</span>
                                {hasContent && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-ios-green mt-1 absolute bottom-2"></div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {profile?.role !== 'client' && (
                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                        <button className="flex items-center gap-2 text-ios-blue font-bold px-4 py-2 hover:bg-blue-50 rounded-xl transition-colors">
                            <FileText size={20} weight="bold" />
                            <span>Ver Resumo Mensal</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
