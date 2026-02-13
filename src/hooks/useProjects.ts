import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';

export const useProjects = () => {
    const { user, profile } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !profile || !profile.masterUid) {
            setProjects([]);
            setLoading(false);
            return;
        }

        const projectsRef = collection(db, `users/${profile.masterUid}/projects`);
        const q = query(projectsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const allProjects = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Project[];

                if (profile.role !== 'master' && profile.allowedProjects) {
                    // Filter projects allowed for this user
                    const allowed = allProjects.filter(p => profile.allowedProjects?.includes(p.id));
                    setProjects(allowed);
                } else {
                    // Master sees all
                    setProjects(allProjects);
                }
                setLoading(false);
            } catch (err) {
                console.error("Error processing projects:", err);
                setError("Erro ao carregar obras.");
                setLoading(false);
            }
        }, (err) => {
            console.error("Firestore Error:", err);
            setError("Erro de conexão.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, profile]);

    return { projects, loading, error };
};
