import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import type { DailyLog } from '../types';

export const useDailyLogs = (projectId: string | undefined) => {
    const { profile } = useAuth();
    const [logs, setLogs] = useState<Record<string, DailyLog>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId || !profile?.masterUid) return;

        const logsRef = collection(db, `users/${profile.masterUid}/projects/${projectId}/dailyLogs`);
        const q = query(logsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logsData: Record<string, DailyLog> = {};
            snapshot.docs.forEach(doc => {
                logsData[doc.id] = doc.data() as DailyLog;
            });
            setLogs(logsData);
            setLoading(false);
        }, (error) => {
            console.error("Error loading logs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [projectId, profile]);

    return { logs, loading };
};
