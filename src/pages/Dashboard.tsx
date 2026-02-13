import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { HardHat, Plus, CalendarBlank, Trash, CaretRight } from '@phosphor-icons/react';
import { clsx } from 'clsx';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const Dashboard: React.FC = () => {
    const { projects, loading } = useProjects();
    const { profile } = useAuth();
    const navigate = useNavigate();

    const handleDelete = async (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        if (confirm("Tem a certeza que deseja apagar esta obra?")) {
            try {
                await deleteDoc(doc(db, `users/${profile?.masterUid}/projects/${projectId}`));
            } catch (error) {
                alert("Erro ao apagar obra.");
            }
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-full text-gray-400">
                <div className="animate-spin mb-4"><HardHat size={32} weight="duotone" /></div>
                <p>A carregar obras...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Minhas Obras</h1>
                    <p className="text-gray-500 mt-1">Selecione uma obra para gerir</p>
                </div>

                {profile?.role === 'master' && (
                    <button
                        onClick={() => {/* TODO: Open Modal */ }}
                        className="bg-ios-blue hover:bg-yellow-500 text-gray-900 px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-yellow-200 flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <Plus size={20} weight="bold" />
                        <span className="hidden md:inline">Nova Obra</span>
                    </button>
                )}
            </div>

            {projects.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
                    <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <HardHat size={40} weight="fill" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-700">Nenhuma obra encontrada</h3>
                    <p className="text-gray-400 text-sm mt-2">Comece por criar uma nova obra.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            onClick={() => navigate(`/project/${project.id}/calendar`)}
                            className="group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                        >
                            {/* Status Badge */}
                            <div className={clsx(
                                "absolute top-6 right-6 text-[10px] uppercase font-bold px-3 py-1 rounded-full",
                                project.status === 'Em Andamento' ? 'bg-blue-50 text-blue-600' :
                                    project.status === 'Concluído' ? 'bg-green-50 text-green-600' :
                                        project.status === 'Atrasado' ? 'bg-red-50 text-red-600' :
                                            'bg-gray-100 text-gray-500'
                            )}>
                                {project.status}
                            </div>

                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-900 group-hover:text-ios-blue transition-colors">
                                    {project.name}
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">{project.client}</p>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-4">
                                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                    <CalendarBlank size={16} weight="fill" className="text-gray-300" />
                                    <span>{new Date(project.startDate).toLocaleDateString('pt-PT')}</span>
                                </div>

                                {profile?.role === 'master' && (
                                    <button
                                        onClick={(e) => handleDelete(e, project.id)}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash size={18} weight="bold" />
                                    </button>
                                )}
                            </div>

                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                                <CaretRight className="text-gray-300" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
