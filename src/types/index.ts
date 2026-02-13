export type UserRole = 'master' | 'user' | 'client';

export interface UserPermission {
    role: UserRole;
    masterUid: string; // The UID of the master account this user belongs to
    allowedProjects?: string[]; // IDs of projects this user can access
    createdAt?: string;
}

export interface UserProfile extends UserPermission {
    uid: string;
    email: string | null;
}

export interface Project {
    id: string;
    name: string;
    client: string;
    company: string;
    startDate: string;
    deliveryDate?: string;
    status: 'Em Andamento' | 'Atrasado' | 'Concluído' | 'Paralisado';
    companies: { id: number; name: string }[];
    checklist: { id: number; text: string; completed: boolean }[];
    financial: FinancialRecord[];
    benchmarks: Benchmark[];
}

export interface Benchmark {
    id: number;
    month: string; // YYYY-MM
    delayDays: number;
    newDeliveryDate: string; // YYYY-MM-DD
    notes?: string;
}

export interface FinancialRecord {
    id: number;
    month: string; // YYYY-MM
    planned: number;
    measured: number;
}

export interface DailyLog {
    weatherMorning: string;
    weatherAfternoon: string;
    temperature: string;
    workforce: WorkforceItem[];
    events: string;
    materials: any[]; // TODO: Define specific type if known
    photos: PhotoItem[];
    eventPhotos: PhotoItem[];
    materialPhotos: PhotoItem[];
    meeting: {
        hasMeeting: boolean;
        pdfFile?: string;
        pdfName?: string;
    };
}

export interface WorkforceItem {
    company: string;
    role: string;
    count: string | number;
}

export interface PhotoItem {
    url: string;
    caption: string;
    storagePath: string;
}
