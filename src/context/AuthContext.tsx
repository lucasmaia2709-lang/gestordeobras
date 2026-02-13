import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, limit } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserProfile } from '../types';

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            if (firebaseUser) {
                setUser(firebaseUser);
                try {
                    // 1. Check Permissions Collection
                    if (!firebaseUser.email) throw new Error("No email provided");

                    const permRef = doc(db, 'permissions', firebaseUser.email);
                    const permSnap = await getDoc(permRef);

                    if (permSnap.exists()) {
                        const data = permSnap.data() as any;
                        setProfile({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            role: data.role,
                            masterUid: data.masterUid,
                            allowedProjects: data.allowedProjects || []
                        });
                    } else {
                        // 2. Fallback: Check if it's a legacy Master
                        // Logic: Check if there's any project under 'users/{uid}/projects'
                        const projectsRef = collection(db, `users/${firebaseUser.uid}/projects`);
                        const q = query(projectsRef, limit(1));
                        const projSnap = await getDocs(q);

                        if (!projSnap.empty) {
                            // Is Master
                            setProfile({
                                uid: firebaseUser.uid,
                                email: firebaseUser.email,
                                role: 'master',
                                masterUid: firebaseUser.uid,
                                allowedProjects: undefined
                            });
                            // Ideally we should sync this to permissions, but let's keep it read-only for now or do it later
                        } else {
                            // No permission, no legacy data -> Deny Access
                            await signOut(auth);
                            setUser(null);
                            setProfile(null);
                            alert("Acesso Negado: O seu email não tem permissão para aceder a esta aplicação.");
                        }
                    }
                } catch (error) {
                    console.error("Auth Error:", error);
                    // Fallback for safety - maybe network error?
                    // For now, logout
                    await signOut(auth);
                    setUser(null);
                    setProfile(null);
                }
            } else {
                setUser(null);
                setProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
