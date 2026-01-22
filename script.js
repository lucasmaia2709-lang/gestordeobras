import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, where, updateDoc, arrayUnion, arrayRemove, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuração Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB4lYMnm7e01XjoXVD1w2z_6eWqtQRZ2JY",
    authDomain: "gestorde-obras.firebaseapp.com",
    projectId: "gestorde-obras",
    storageBucket: "gestorde-obras.firebasestorage.app",
    messagingSenderId: "1087144807634",
    appId: "1:1087144807634:web:30cbf8ad83a33d7e7b710b",
    measurementId: "G-MW6FVJFDW5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Estado Global
let state = {
    user: null, 
    role: 'master', // 'master', 'user', 'client'
    masterUid: null, // UID do dono dos dados (se for user/client)
    allowedProjects: [], // IDs permitidos para user/client
    
    view: 'auth', 
    authMode: 'login', 
    currentProjectId: null, 
    currentProjectData: null, 
    activeTab: 'calendar',
    isMobileMenuOpen: false, 
    selectedDate: new Date().toISOString().split('T')[0], 
    calendarViewDate: new Date(),
    projects: [], 
    logsCache: {}, 
    currentDailyLog: null, 
    isEditing: true, 
    financialConfigMode: false, 
    tempFinancial: [], 
    editingFinancialId: null
};

// Autenticação e Verificação de Permissões
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('global-loader');
    if (user) { 
        state.user = user; 
        document.getElementById('user-email-display').textContent = user.email; 
        
        // Verificar Permissões (Role Check)
        try {
            const permRef = doc(db, 'permissions', user.email);
            const permSnap = await getDoc(permRef);
            
            if (permSnap.exists()) {
                // Tem permissão explícita (Equipa ou Cliente)
                const data = permSnap.data();
                state.role = data.role;
                state.masterUid = data.masterUid;
                state.allowedProjects = data.allowedProjects || [];
            } else {
                // NÃO tem permissão na lista. Verificar se é um Master existente (tem projetos?)
                // Isto impede que estranhos entrem, mas deixa o dono original entrar.
                const projSnap = await getDocs(query(collection(db, `users/${user.uid}/projects`), limit(1)));
                
                if (!projSnap.empty) {
                    // É o Master (tem dados antigos). 
                    // Auto-adicionar à lista de permissões para evitar esta verificação no futuro.
                    await setDoc(permRef, { role: 'master', masterUid: user.uid, createdAt: new Date().toISOString() });
                    state.role = 'master';
                    state.masterUid = user.uid;
                    state.allowedProjects = null;
                } else {
                    // É um utilizador sem permissão e sem dados -> BLOQUEAR
                    await signOut(auth);
                    alert("Acesso Negado: O seu email não tem permissão para aceder a esta aplicação. Peça ao administrador para o cadastrar.");
                    if(loader) loader.style.display = 'none';
                    return; // Interrompe a inicialização
                }
            }
            
            updateUIForRole();
            initApp(); 
        } catch (e) {
            console.error("Erro permissões:", e);
            // Em caso de erro de rede, tentar assumir master se for o dono (fallback de segurança)
            if(user) {
                 state.role = 'master'; state.masterUid = user.uid; updateUIForRole(); initApp();
            }
        }
    } else { 
        state.user = null; 
        state.view = 'auth'; 
        state.projects = []; 
        if(loader) loader.style.display = 'none'; 
        renderApp(); 
    }
});

function updateUIForRole() {
    const roleBadge = document.getElementById('role-badge');
    const manageBtn = document.getElementById('btn-manage-users');
    const configBtn = document.getElementById('btn-config-project');

    const roleNames = { 'master': 'Master', 'user': 'Equipa', 'client': 'Cliente' };
    if(roleBadge) {
        roleBadge.textContent = roleNames[state.role] || 'Master';
        roleBadge.className = `text-[10px] uppercase font-bold tracking-wider ${state.role === 'master' ? 'text-blue-600' : state.role === 'client' ? 'text-green-600' : 'text-purple-600'}`;
    }

    if (state.role === 'master') {
        if(manageBtn) manageBtn.classList.remove('hidden');
        if(configBtn) configBtn.classList.remove('hidden');
    } else {
        if(manageBtn) manageBtn.classList.add('hidden');
        if(configBtn) configBtn.classList.add('hidden');
    }
}

function initApp() {
    const targetUid = state.masterUid; 
    const projectsRef = collection(db, `users/${targetUid}/projects`);
    const q = query(projectsRef);

    onSnapshot(q, (snapshot) => {
        let allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (state.role !== 'master' && state.allowedProjects) {
            state.projects = allProjects.filter(p => state.allowedProjects.includes(p.id));
        } else {
            state.projects = allProjects;
        }

        if (state.currentProjectId) {
            const p = state.projects.find(p => p.id === state.currentProjectId);
            if(p) state.currentProjectData = p;
            else window.backToProjectList();
        }

        if (state.view === 'auth') state.view = 'projectList';
        document.getElementById('global-loader').style.display = 'none';
        renderApp(false); 
    }, (error) => { console.error(error); document.getElementById('global-loader').style.display = 'none'; });
}

// --- LÓGICA DE AUTENTICAÇÃO SEGURA ---
window.toggleAuthMode = () => { state.authMode = state.authMode === 'login' ? 'register' : 'login'; renderApp(true); };

window.handleAuth = async (e) => {
    e.preventDefault(); 
    const email = document.getElementById('auth-email').value.trim(); 
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-btn'); 
    const err = document.getElementById('auth-error');

    if (password.length < 6) { 
        err.innerHTML = 'Senha min 6 caracteres.'; 
        err.classList.remove('hidden'); 
        return; 
    }
    
    btn.disabled = true; 
    btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Processando...'; 
    err.classList.add('hidden');

    try {
        if (state.authMode === 'register') {
            // 1. VERIFICAÇÃO PRÉVIA: O email tem permissão?
            const permRef = doc(db, 'permissions', email);
            const permSnap = await getDoc(permRef);

            if (!permSnap.exists()) {
                throw new Error("Este email não tem autorização para se cadastrar. Peça ao Master.");
            }

            // 2. Se existe permissão, cria a conta
            await createUserWithEmailAndPassword(auth, email, password);
            
        } else {
            // Login normal
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (e) { 
        btn.disabled = false; 
        btn.innerText = 'Tentar Novamente'; 
        
        let msg = e.message;
        if(msg.includes('auth/email-already-in-use')) msg = "Este email já está cadastrado. Tente fazer login.";
        if(msg.includes('auth/invalid-credential') || msg.includes('auth/user-not-found')) msg = "Email ou senha incorretos.";
        
        err.textContent = msg; 
        err.classList.remove('hidden'); 
    }
};

window.handleLogout = async () => { try { await signOut(auth); } catch (e) {} };

// Navegação
window.toggleMobileMenu = () => { state.isMobileMenuOpen = !state.isMobileMenuOpen; const s = document.getElementById('sidebar'); if(state.isMobileMenuOpen) s.classList.remove('-translate-x-full','hidden'); else s.classList.add('-translate-x-full','hidden'); };
window.switchTab = (t) => { state.activeTab = t; if (state.isMobileMenuOpen) window.toggleMobileMenu(); renderApp(true); };
window.backToProjectList = () => { state.currentProjectId = null; state.view = 'projectList'; renderApp(true); };

window.selectProject = async (id) => {
    state.currentProjectId = id; 
    state.currentProjectData = state.projects.find(p => p.id === id); 
    state.view = 'projectDetails'; 
    state.activeTab = 'calendar';
    
    const targetUid = state.masterUid;
    // Carrega todos os logs para cache (crucial para o botão de copiar dia anterior)
    onSnapshot(collection(db, `users/${targetUid}/projects/${id}/dailyLogs`), (s) => {
        state.logsCache = {}; s.docs.forEach(d => state.logsCache[d.id] = d.data()); renderApp(false);
    });
    await window.loadDailyLogForDate(state.selectedDate); 
    renderApp(true);
};

// Datas
window.changeDate = async (v) => { state.selectedDate = v; await window.loadDailyLogForDate(v); renderApp(false); };
window.goToDate = async (d) => { 
    state.selectedDate = d; 
    await window.loadDailyLogForDate(d);
    if (state.role === 'client') window.openClientViewModal(); else window.switchTab('daily'); 
};
window.changeMonth = (o) => { state.calendarViewDate.setMonth(state.calendarViewDate.getMonth() + o); renderApp(false); };

// Carregar Diário
window.loadDailyLogForDate = async (date) => {
    if(!state.currentProjectId) return;
    const c = state.logsCache[date];
    if (c) { 
        state.currentDailyLog = JSON.parse(JSON.stringify(c)); 
        if(!state.currentDailyLog.weatherMorning) state.currentDailyLog.weatherMorning = state.currentDailyLog.weather || 'sol';
        if(!state.currentDailyLog.weatherAfternoon) state.currentDailyLog.weatherAfternoon = state.currentDailyLog.weather || 'sol';
        state.currentDailyLog.eventPhotos = state.currentDailyLog.eventPhotos || [];
        state.currentDailyLog.materialPhotos = state.currentDailyLog.materialPhotos || [];
        state.currentDailyLog.photos = state.currentDailyLog.photos || [];
        state.isEditing = false; 
    } else { 
        state.currentDailyLog = createEmptyLog(); 
        state.isEditing = (state.role !== 'client'); 
    }
};

window.enableEditMode = () => { 
    if (state.role === 'client') return; 
    state.isEditing = true; 
    renderProjectContent(false); 
};

window.persistCurrentLog = async () => {
    if(!state.currentProjectId || state.role === 'client') return;
    const btn = document.getElementById('save-btn'); const old = btn.innerHTML; btn.innerHTML = '...'; btn.disabled = true;
    try {
        await setDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}/dailyLogs/${state.selectedDate}`), state.currentDailyLog, { merge: true });
        state.isEditing = false; btn.innerHTML = 'Salvo!'; setTimeout(() => renderProjectContent(false), 800);
    } catch (e) { alert("Erro ao salvar."); btn.innerHTML = old; btn.disabled = false; }
};

// Helpers de Edição
window.updateDailyLogData = (f, v) => { state.currentDailyLog[f] = v; if(f.startsWith('weather')) renderProjectContent(false); };
window.updateSubItem = (arr, i, f, v) => { state.currentDailyLog[arr][i][f] = v; };
window.addSubItem = (arr, obj) => { state.currentDailyLog[arr].push(obj); renderProjectContent(false); };
window.removeSubItem = (arr, i) => { state.currentDailyLog[arr].splice(i, 1); renderProjectContent(false); };

// NOVO: Copiar Efetivo do Dia Anterior
window.copyPreviousWorkforce = () => {
    if (state.role === 'client' || !state.isEditing) return;

    const currentDate = state.selectedDate;
    
    // 1. Obter todas as datas disponíveis no cache
    const availableDates = Object.keys(state.logsCache).sort();
    
    // 2. Filtrar apenas datas anteriores à atual
    const pastDates = availableDates.filter(d => d < currentDate);
    
    // 3. Reverter para ter as mais recentes primeiro (Ontem, Anteontem...)
    pastDates.reverse();

    let foundWorkforce = null;
    let foundDate = null;

    // 4. Procurar o primeiro dia que tenha efetivo
    for (const date of pastDates) {
        const log = state.logsCache[date];
        if (log.workforce && Array.isArray(log.workforce) && log.workforce.length > 0) {
            foundWorkforce = log.workforce;
            foundDate = date;
            break;
        }
    }

    if (foundWorkforce) {
        // Deep copy para evitar problemas de referência
        state.currentDailyLog.workforce = JSON.parse(JSON.stringify(foundWorkforce));
        
        // Formatar data para exibição amigável
        const dateObj = new Date(foundDate);
        const dateStr = dateObj.toLocaleDateString('pt-PT');
        
        alert(`Efetivo copiado do dia ${dateStr} com sucesso!`);
        renderProjectContent(false);
    } else {
        alert("Não foi encontrado nenhum registo de efetivo em dias anteriores.");
    }
};

// Imagens
const compressImage = async (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024; const MAX_HEIGHT = 1024;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })); }, 'image/jpeg', 0.7);
            };
        };
    });
};

window.handlePhotoUpload = async (input, targetArray = 'photos') => {
    if (state.role === 'client') return;
    if (input.files && input.files.length > 0) {
        const container = input.parentElement; const originalContent = container.innerHTML; container.innerHTML = '<i class="ph ph-spinner animate-spin text-2xl text-blue-500"></i>';
        try {
            const files = Array.from(input.files);
            const uploadPromises = files.map(async (originalFile) => {
                const compressedFile = await compressImage(originalFile);
                const storageRef = ref(storage, `users/${state.masterUid}/projects/${state.currentProjectId}/${targetArray}/${Date.now()}_${originalFile.name}`);
                const snapshot = await uploadBytes(storageRef, compressedFile);
                return { url: await getDownloadURL(snapshot.ref), caption: 'Foto', storagePath: snapshot.ref.fullPath };
            });
            const newPhotos = await Promise.all(uploadPromises);
            if(!state.currentDailyLog[targetArray]) state.currentDailyLog[targetArray] = [];
            state.currentDailyLog[targetArray].push(...newPhotos);
            const logRef = doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}/dailyLogs/${state.selectedDate}`);
            await setDoc(logRef, state.currentDailyLog, { merge: true });
            renderProjectContent(false);
        } catch (error) { alert("Erro ao enviar foto(s): " + error.message); container.innerHTML = originalContent; }
    }
};

window.handleDailyPdfUpload = (i) => uploadFile(i, 'docs');
async function uploadFile(input, pathType) {
    if (state.role === 'client') return;
    if (input.files[0]) {
        const file = input.files[0];
        const sRef = ref(storage, `users/${state.masterUid}/projects/${state.currentProjectId}/${pathType}/${Date.now()}_${file.name}`);
        try {
            const snap = await uploadBytes(sRef, file); const url = await getDownloadURL(snap.ref);
            state.currentDailyLog.meeting.pdfFile = url; state.currentDailyLog.meeting.pdfName = file.name;
            const logRef = doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}/dailyLogs/${state.selectedDate}`);
            await setDoc(logRef, state.currentDailyLog, { merge: true });
            renderProjectContent(false);
        } catch(e) { alert("Erro upload: " + e.message); }
    }
}

// Download ZIP
window.downloadPhotosZip = async () => {
    const photos = state.currentDailyLog.photos || [];
    if (photos.length === 0) { alert("Sem fotos."); return; }
    const btn = document.getElementById('btn-zip-photos');
    const originalContent = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner animate-spin"></i>'; btn.disabled = true;
    try {
        const zip = new JSZip(); const folder = zip.folder(`Fotos_${state.selectedDate}`);
        const promises = photos.map(async (photo, index) => {
            try {
                const response = await fetch(photo.url); const blob = await response.blob();
                const ext = blob.type.split('/')[1] || 'jpg';
                const filename = `foto_${index + 1}.${ext}`;
                folder.file(filename, blob);
            } catch (e) {}
        });
        await Promise.all(promises);
        const content = await zip.generateAsync({type:"blob"});
        const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `Fotos_${state.selectedDate}.zip`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (e) { alert("Erro ao gerar ZIP."); } finally { btn.innerHTML = originalContent; btn.disabled = false; }
};

// Cadastros
window.addCompany = async () => { 
    if(state.role === 'client') return;
    const v = document.getElementById('new-company-name').value; if(v) await updateDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}`), { companies: arrayUnion({ id: Date.now(), name: v }) }); 
};
window.deleteCompany = async (id) => { 
    if(state.role === 'client') return;
    if(confirm('Apagar?')) { 
        const n = state.currentProjectData.companies.filter(c => String(c.id) !== String(id)); 
        await updateDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}`), { companies: n }); 
    } 
};
window.addChecklist = async () => { 
    if(state.role !== 'master' && state.role !== 'user') return;
    const v = document.getElementById('new-todo').value; if(v) await updateDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}`), { checklist: arrayUnion({ id: Date.now(), text: v, completed: false }) }); 
};
window.toggleChecklist = async (id) => { 
    if(state.role !== 'master' && state.role !== 'user') return;
    const n = state.currentProjectData.checklist.map(i => i.id === id ? { ...i, completed: !i.completed } : i); 
    await updateDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}`), { checklist: n }); 
};
window.deleteChecklistItem = async (id) => { 
    if(state.role !== 'master' && state.role !== 'user') return;
    const n = state.currentProjectData.checklist.filter(i => i.id !== id); 
    await updateDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}`), { checklist: n }); 
};

// Financeiro
window.toggleFinancialConfig = () => { 
    if(state.role !== 'master') return; 
    state.financialConfigMode = !state.financialConfigMode; 
    if(state.financialConfigMode) state.tempFinancial = JSON.parse(JSON.stringify(state.currentProjectData.financial || []));
    renderProjectContent(false); 
};
window.generateFinancialGrid = () => {
    const startStr = document.getElementById('fin-start-month').value; const endStr = document.getElementById('fin-end-month').value;
    if(!startStr || !endStr || startStr > endStr) { alert("Datas inválidas."); return; }
    const start = new Date(startStr + "-01"); const end = new Date(endStr + "-01");
    const existingMap = {}; state.tempFinancial.forEach(f => existingMap[f.month] = f);
    const newTemp = []; let current = new Date(start);
    while(current <= end) {
        const y = current.getFullYear(); const m = String(current.getMonth() + 1).padStart(2,'0'); const monthStr = `${y}-${m}`;
        newTemp.push(existingMap[monthStr] || { id: Date.now() + newTemp.length, month: monthStr, planned: 0, measured: 0 });
        current.setMonth(current.getMonth() + 1);
    }
    state.tempFinancial = newTemp; renderProjectContent(false);
};
window.updateTempFinancial = (id, field, value) => { state.tempFinancial = state.tempFinancial.map(f => f.id === id ? { ...f, [field]: parseFloat(value) || 0 } : f); };
window.saveFinancialConfig = async () => {
    try {
        await updateDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}`), { financial: state.tempFinancial });
        state.financialConfigMode = false; renderProjectContent(false);
    } catch (e) { alert("Erro ao salvar."); }
};
window.startEditingFinancial = (id) => {
    if(state.role === 'client') return; 
    state.editingFinancialId = id; renderProjectContent(false);
    setTimeout(() => { const el = document.getElementById(`fin-input-${id}`); if(el) { el.focus(); el.select(); } }, 50);
};
window.stopEditingFinancial = async (id, val) => {
    const numericVal = parseFloat(val);
    if (!isNaN(numericVal) || val === '') {
        const newList = (state.currentProjectData.financial || []).map(i => i.id === id ? { ...i, measured: val === '' ? 0 : numericVal } : i);
        state.currentProjectData.financial = newList;
        await updateDoc(doc(db, `users/${state.masterUid}/projects/${state.currentProjectId}`), { financial: newList });
    }
    state.editingFinancialId = null; renderProjectContent(false);
};

// GESTÃO DE UTILIZADORES
window.openUsersModal = async () => {
    if(state.role !== 'master') return;
    const modal = document.getElementById('users-modal');
    modal.classList.add('modal-open');
    
    const projectsDiv = document.getElementById('user-form-projects');
    projectsDiv.innerHTML = state.projects.map(p => `
        <label class="flex items-center space-x-2 text-xs">
            <input type="checkbox" value="${p.id}" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 project-check">
            <span>${p.name}</span>
        </label>
    `).join('');

    const q = query(collection(db, 'permissions'), where('masterUid', '==', state.user.uid));
    const snap = await getDocs(q);
    const listDiv = document.getElementById('users-list');
    
    if(snap.empty) {
        listDiv.innerHTML = '<p class="text-xs text-gray-400 p-2">Nenhum utilizador cadastrado.</p>';
    } else {
        listDiv.innerHTML = snap.docs.map(d => {
            const data = d.data();
            const projCount = (data.allowedProjects || []).length;
            const badgeColor = data.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
            const roleName = data.role === 'user' ? 'Utilizador' : 'Cliente';
            return `<div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100"><div><div class="flex items-center gap-2"><span class="font-bold text-sm text-gray-700">${d.id}</span><span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeColor}">${roleName}</span></div><p class="text-xs text-gray-500">${projCount} obra(s)</p></div><button onclick="window.removeUser('${d.id}')" class="text-gray-400 hover:text-red-500 p-2"><i class="ph-bold ph-trash"></i></button></div>`;
        }).join('');
    }
};
window.closeUsersModal = () => document.getElementById('users-modal').classList.remove('modal-open');
window.handleAddUser = async (e) => {
    e.preventDefault();
    const email = document.getElementById('user-form-email').value.trim();
    const role = document.getElementById('user-form-role').value;
    const checks = document.querySelectorAll('.project-check:checked');
    const allowedProjects = Array.from(checks).map(c => c.value);

    if(!email || allowedProjects.length === 0) { alert("Preencha o email e selecione pelo menos uma obra."); return; }

    try {
        await setDoc(doc(db, 'permissions', email), {
            role: role,
            masterUid: state.user.uid,
            allowedProjects: allowedProjects,
            createdAt: new Date().toISOString()
        });
        alert(`Acesso concedido a ${email}.`);
        document.getElementById('user-form-email').value = '';
        window.openUsersModal(); 
    } catch(err) { alert("Erro ao salvar permissão: " + err.message); }
};
window.removeUser = async (email) => { if(confirm(`Remover acesso de ${email}?`)) { await deleteDoc(doc(db, 'permissions', email)); window.openUsersModal(); } };

// MODAL CLIENTE
window.openClientViewModal = () => {
    const modal = document.getElementById('client-view-modal');
    const content = document.getElementById('client-modal-content');
    const l = state.currentDailyLog;

    const d = new Date(state.selectedDate);
    document.getElementById('client-modal-date').textContent = d.getDate() + ' ' + d.toLocaleString('pt-PT', { month: 'short' });
    document.getElementById('client-modal-date-label').textContent = d.toLocaleString('pt-PT', { weekday: 'long' });
    document.getElementById('client-modal-temp').textContent = (l.temperature || '--') + '°';
    document.getElementById('client-modal-weather-text').textContent = `${l.weatherMorning} / ${l.weatherAfternoon}`;
    
    const w = (l.weatherMorning || '').toLowerCase();
    let icon = 'ph-sun'; if(w.includes('chuva')) icon = 'ph-cloud-rain'; else if(w.includes('nublado')) icon = 'ph-cloud';
    document.getElementById('client-modal-weather-icon').className = `ph-fill ${icon} text-2xl text-yellow-300`;

    const allPhotos = [...(l.photos||[]), ...(l.eventPhotos||[]), ...(l.materialPhotos||[])];
    content.innerHTML = `<div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2"><i class="ph-fill ph-users text-indigo-500"></i> Equipa em Obra</h4><div class="space-y-3">${l.workforce && l.workforce.length > 0 ? l.workforce.map(w => `<div class="flex justify-between items-center border-b border-gray-50 last:border-0 pb-2 last:pb-0"><div><p class="font-bold text-sm text-gray-800">${w.role}</p><p class="text-[10px] uppercase text-gray-400 font-bold">${w.company || 'Geral'}</p></div><span class="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs">${w.count} pessoas</span></div>`).join('') : '<p class="text-sm text-gray-400 italic">Sem registo de equipa.</p>'}</div></div>${allPhotos.length > 0 ? `<div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2"><i class="ph-fill ph-camera text-blue-500"></i> Galeria do Dia</h4><div class="grid grid-cols-2 gap-3">${allPhotos.map(p => `<div class="relative aspect-square rounded-xl overflow-hidden shadow-sm"><img src="${p.url}" class="w-full h-full object-cover" onclick="window.open('${p.url}')"></div>`).join('')}</div></div>` : ''}<div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"><h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2"><i class="ph-fill ph-clipboard-text text-amber-500"></i> Notas do Dia</h4><p class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">${l.events || 'Nenhuma ocorrência relevante registada hoje.'}</p></div>`;
    modal.classList.remove('hidden'); modal.classList.add('flex');
};

// Gestão Obras
window.openProjectModal = (isEdit) => { 
    if(state.role !== 'master') return;
    const m = document.getElementById('project-modal');
    if(isEdit && state.currentProjectId) {
        const p = state.currentProjectData;
        document.getElementById('modal-project-id').value = p.id; 
        document.getElementById('modal-project-name').value = p.name;
        document.getElementById('modal-client-name').value = p.client; 
        document.getElementById('modal-company-name').value = p.company;
        document.getElementById('modal-start-date').value = p.startDate; 
        document.getElementById('modal-delivery-date').value = p.deliveryDate || '';
        document.getElementById('modal-status').value = p.status;
        document.getElementById('modal-title').innerText = "Editar Obra";
    } else { 
        document.getElementById('modal-project-id').value = ""; document.getElementById('modal-title').innerText = "Nova Obra"; document.getElementById('modal-project-name').value = ""; document.getElementById('modal-client-name').value = ""; document.getElementById('modal-company-name').value = ""; document.getElementById('modal-start-date').value = ""; document.getElementById('modal-delivery-date').value = "";
    }
    m.classList.add('modal-open');
};
window.closeProjectModal = () => document.getElementById('project-modal').classList.remove('modal-open');
window.handleProjectForm = async (e) => {
    e.preventDefault(); 
    if(state.role !== 'master') return;
    const btn = document.getElementById('btn-save-project'); btn.innerHTML = '...'; btn.disabled = true;
    const id = document.getElementById('modal-project-id').value;
    const d = { name: document.getElementById('modal-project-name').value, client: document.getElementById('modal-client-name').value, company: document.getElementById('modal-company-name').value, startDate: document.getElementById('modal-start-date').value, deliveryDate: document.getElementById('modal-delivery-date').value, status: document.getElementById('modal-status').value, companies: id?(state.currentProjectData?.companies||[]):[{id:1,name:'Própria'}], checklist: id?(state.currentProjectData?.checklist||[]):[], financial: id?(state.currentProjectData?.financial||[]):[] };
    try {
        if(id) await updateDoc(doc(db, `users/${state.masterUid}/projects/${id}`), d); else await setDoc(doc(collection(db, `users/${state.masterUid}/projects`)), d); window.closeProjectModal();
    } catch(e) { alert("Erro ao salvar."); } finally { btn.innerHTML = 'Salvar Obra'; btn.disabled = false; }
};
window.deleteProject = async (id, e) => { e.stopPropagation(); if(state.role !== 'master') return; if(confirm("Apagar?")) await deleteDoc(doc(db, `users/${state.masterUid}/projects/${id}`)); };

// Renderização
function renderApp(animate) {
    const s = document.getElementById('sidebar'); const c = document.getElementById('content-area'); const m = document.getElementById('mobile-header');
    if (state.view === 'auth') { s.classList.add('hidden'); m.classList.add('hidden'); c.innerHTML = generateAuthHTML(); }
    else if (state.view === 'projectList') { s.classList.add('hidden'); m.classList.remove('hidden'); c.innerHTML = generateProjectListHTML(); }
    else { s.classList.remove('hidden'); m.classList.remove('hidden'); renderSidebar(); renderProjectContent(animate); }
}

function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    let tabs = [{ id: 'calendar', icon: 'ph-calendar', label: 'Calendário' }, { id: 'checklist', icon: 'ph-check-square', label: 'Checklist' }, { id: 'financial', icon: 'ph-currency-dollar', label: 'Financeiro' }, { id: 'companies', icon: 'ph-briefcase', label: 'Cadastros' }];
    if (state.role === 'client') tabs = tabs.filter(t => t.id === 'calendar' || t.id === 'financial');
    nav.innerHTML = tabs.map(t => `<button onclick="window.switchTab('${t.id}')" id="nav-${t.id}" class="nav-item w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-colors ${state.activeTab === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-blue-50'}"><i class="ph ${t.icon} text-xl"></i><span class="font-medium">${t.label}</span></button>`).join('');
}

function renderProjectContent(animate) {
    const c = document.getElementById('content-area');
    const scrollElement = document.querySelector('main');
    const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
    const currentHeight = c.offsetHeight;
    c.style.minHeight = `${currentHeight}px`;

    if (state.role === 'client' && !['calendar', 'financial'].includes(state.activeTab)) state.activeTab = 'calendar';
    
    if (state.activeTab === 'calendar') c.innerHTML = generateCalendarHTML();
    else if (state.activeTab === 'daily') c.innerHTML = window.generateDailyLogHTML_Original();
    else if (state.activeTab === 'checklist') c.innerHTML = window.generateChecklistHTML_Original();
    else if (state.activeTab === 'companies') c.innerHTML = window.generateCompaniesHTML_Original();
    else if (state.activeTab === 'financial') c.innerHTML = generateFinancialHTML();
    else if (state.activeTab === 'report') c.innerHTML = window.generateReportPreviewHTML_Original();
    
    if (animate && c.firstElementChild) c.firstElementChild.classList.add('animate-fade-in');
    setTimeout(() => { c.style.minHeight = ''; if (scrollElement) scrollElement.scrollTop = scrollPos; }, 0);
}

// HTML Generators
function createEmptyLog() { return { weatherMorning: 'sol', weatherAfternoon: 'sol', temperature: '', workforce: [], events: '', materials: [], photos: [], eventPhotos: [], materialPhotos: [], meeting: { hasMeeting: false } }; }
function getUniqueRoles() { const s = new Set(); Object.values(state.logsCache).forEach(l => l.workforce?.forEach(w => s.add(w.role))); return Array.from(s).map(r => `<option value="${r}">`).join(''); }
function generateAuthHTML() { return `<div class="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in mx-auto my-auto mt-10 md:mt-20"><div class="bg-blue-600 p-8 text-center"><h1 class="text-2xl font-bold text-white">ObraApp</h1></div><div class="p-6"><form onsubmit="window.handleAuth(event)" class="space-y-4"><input id="auth-email" class="w-full border rounded-lg px-4 py-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Email"><input type="password" id="auth-password" class="w-full border rounded-lg px-4 py-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senha"><div id="auth-error" class="text-red-500 text-sm hidden bg-red-50 p-2 rounded"></div><button id="auth-btn" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-md">Entrar / Criar</button></form><div class="mt-6 text-center"><button onclick="window.toggleAuthMode()" class="text-blue-600 font-medium">${state.authMode==='login'?'Criar Nova Conta':'Fazer Login'}</button></div></div></div>`; }
function generateProjectListHTML() { return `<div class="max-w-6xl mx-auto w-full"><div class="flex justify-between items-center mb-6 px-2"><div><h1 class="text-2xl font-bold text-gray-800">Obras</h1><p class="text-gray-500 text-sm">Selecione para gerir</p></div>${state.role === 'master' ? `<button onclick="window.openProjectModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center"><i class="ph-bold ph-plus mr-1"></i> Nova</button>` : ''}</div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">${state.projects.map(p => `<div onclick="window.selectProject('${p.id}')" class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition-transform"><div class="flex justify-between mb-2"><span class="font-bold text-lg text-gray-800">${p.name}</span><span class="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full h-fit">${p.status}</span></div><p class="text-gray-500 text-sm mb-3">${p.client}</p><div class="flex justify-between items-center text-xs text-gray-400 border-t pt-3"><span><i class="ph-fill ph-calendar mr-1"></i>${p.startDate}</span>${state.role === 'master' ? `<button onclick="window.deleteProject('${p.id}', event)" class="p-2 text-gray-300 hover:text-red-500"><i class="ph-bold ph-trash text-lg"></i></button>` : ''}</div></div>`).join('')}</div></div>`; }
function generateCalendarHTML() {
    const p = state.currentProjectData; const y = state.calendarViewDate.getFullYear(); const m = state.calendarViewDate.getMonth();
    const daysInM = new Date(y, m+1, 0).getDate(); const firstD = new Date(y, m, 1).getDay();
    let dHTML = ''; for(let i=0;i<firstD;i++) dHTML+='<div></div>';
    const monthName = state.calendarViewDate.toLocaleString('pt-PT', { month: 'long' });
    let progress = 0; let realProgress = 0; let deviationHTML = '';
    const financial = p.financial || [];
    if (financial.length > 0 && p.startDate) {
        financial.sort((a,b) => a.month.localeCompare(b.month));
        let lastMeasuredIndex = -1;
        for (let i = financial.length - 1; i >= 0; i--) { if (financial[i].measured && financial[i].measured > 0) { lastMeasuredIndex = i; break; } }
        if (lastMeasuredIndex !== -1) {
            const projectTotalPlanned = financial.reduce((acc, curr) => acc + (curr.planned || 0), 0);
            let accPlanned = 0; let accReal = 0;
            for (let i = 0; i <= lastMeasuredIndex; i++) { accPlanned += (financial[i].planned || 0); accReal += (financial[i].measured || 0); }
            if (projectTotalPlanned > 0) { progress = (accPlanned / projectTotalPlanned) * 100; realProgress = (accReal / projectTotalPlanned) * 100; }
            const startDate = new Date(p.startDate); const [mYear, mMonth] = financial[lastMeasuredIndex].month.split('-');
            const measurementDate = new Date(parseInt(mYear), parseInt(mMonth), 0);
            const totalDaysElapsed = Math.ceil((measurementDate - startDate) / (1000 * 60 * 60 * 24));
            if (totalDaysElapsed > 0 && accPlanned > 0) {
                const dailyPlannedValue = accPlanned / totalDaysElapsed; const theoreticalDays = accReal / dailyPlannedValue;
                const diff = totalDaysElapsed - theoreticalDays;
                if(Math.abs(diff) > 1) deviationHTML = `<div class="mt-2 text-xs font-bold ${diff > 0 ? 'text-red-600' : 'text-green-600'} flex items-center justify-end gap-1"><i class="ph-bold ${diff > 0 ? 'ph-trend-down' : 'ph-trend-up'}"></i><span>${Math.abs(Math.round(diff))} dias ${diff > 0 ? 'atraso' : 'adiantamento'}</span></div>`;
            }
        }
    }
    for(let d=1;d<=daysInM;d++) { const dt=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const l=state.logsCache[dt]; const h=l&&(l.workforce?.length||l.events||l.materials?.length); dHTML+=`<button onclick="window.goToDate('${dt}')" class="calendar-day border border-gray-100 rounded-lg active:bg-blue-50 relative flex flex-col items-center justify-center bg-white ${dt===new Date().toISOString().split('T')[0]?'border-blue-500 text-blue-600 font-bold ring-1 ring-blue-500':''} shadow-sm transition-colors hover:bg-gray-50"><span class="text-lg">${d}</span>${h?'<span class="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full"></span>':''}</button>`; }
    return `<div class="max-w-4xl mx-auto w-full"><div class="flex flex-col gap-4 mb-4"><div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100"><div class="flex justify-between items-start mb-3"><div><h2 class="text-xl font-bold text-gray-800">${p.name}</h2><p class="text-xs text-gray-500">${p.client}</p></div></div><div class="w-full bg-gray-100 rounded-full h-2.5 mb-1 overflow-hidden"><div class="bg-blue-600 h-2.5 rounded-full progress-striped animate-fade-in" style="width: ${progress.toFixed(0)}%"></div></div><div class="flex justify-between items-center"><div class="flex flex-col"><span class="text-xs font-bold text-blue-600">${progress.toFixed(0)}% Previsto</span><span class="text-xs font-bold text-green-600">${realProgress.toFixed(0)}% Real</span></div>${deviationHTML}</div></div><div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative"><div class="flex justify-between items-center mb-6 px-2"><button onclick="window.changeMonth(-1)" class="p-2 hover:bg-gray-100 rounded-full"><i class="ph-bold ph-caret-left text-xl"></i></button><h3 class="font-bold text-lg capitalize text-gray-800">${monthName}/${y}</h3><button onclick="window.changeMonth(1)" class="p-2 hover:bg-gray-100 rounded-full"><i class="ph-bold ph-caret-right text-xl"></i></button></div><div class="calendar-grid mb-2 text-center text-xs font-bold text-gray-400 uppercase">${['D','S','T','Q','Q','S','S'].map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid mb-6">${dHTML}</div>${state.role !== 'client' ? `<div class="border-t pt-4 flex justify-center"><button onclick="window.switchTab('report')" class="flex items-center space-x-2 text-sm font-bold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition"><i class="ph-bold ph-file-text text-lg"></i><span>Ver Resumo Mensal</span></button></div>` : ''}</div></div></div>`;
}

// UPDATE: Adicionado botão de Copiar
window.generateDailyLogHTML_Original = function() {
    const l = state.currentDailyLog; const da = !state.isEditing ? 'disabled' : ''; const hi = !state.isEditing ? 'hidden' : '';
    const totalWorkforce = l.workforce.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0);
    const weatherOptions = ['sol','nublado','chuvisco','chuva'];
    
    return `<div class="max-w-4xl mx-auto space-y-4 w-full pb-20">
        <datalist id="roles-list">${getUniqueRoles()}</datalist>
        <div class="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-20">
            <div class="flex justify-between items-center">
                <button onclick="window.switchTab('calendar')" class="text-gray-500 p-2"><i class="ph-bold ph-arrow-left text-xl"></i></button>
                <input type="date" value="${state.selectedDate}" onchange="window.changeDate(this.value)" class="border-0 font-bold text-gray-800 text-lg bg-transparent text-center focus:ring-0">
                <div class="w-10"></div>
            </div>
            ${state.role !== 'client' ? (state.isEditing ? `<button id="save-btn" onclick="window.persistCurrentLog()" class="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-md">Salvar Alterações</button>` : `<button onclick="window.enableEditMode()" class="w-full bg-yellow-500 text-white py-3 rounded-xl font-bold shadow-md">Editar Diário</button>`) : ''}
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 class="font-bold text-gray-700 mb-4 flex items-center gap-2"><i class="ph-fill ph-cloud-sun text-orange-500"></i> Clima</h3>
            <div class="flex flex-col gap-4">
                ${['weatherMorning', 'weatherAfternoon'].map(field => `
                    <div class="flex flex-col gap-1 w-full">
                        <span class="text-[10px] font-bold text-gray-400 uppercase">${field.includes('Morning')?'Manhã':'Tarde'}</span>
                        <div class="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                            ${weatherOptions.map(w => `<button ${da} onclick="window.updateDailyLogData('${field}','${w}')" class="px-2 py-1.5 border rounded text-xs capitalize whitespace-nowrap flex-1 ${l[field]===w ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'} ${!state.isEditing && l[field] !== w ? 'opacity-40' : ''}">${w}</button>`).join('')}
                        </div>
                    </div>`).join('')}
                <div class="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <span class="text-xs font-bold text-gray-400 uppercase">Temp. Média:</span>
                    <input ${da} type="number" value="${l.temperature}" onchange="window.updateDailyLogData('temperature',this.value)" class="bg-gray-50 border rounded w-16 text-center text-sm p-1 outline-none" placeholder="--"> <span class="text-sm text-gray-600">°C</span>
                </div>
            </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-gray-700 flex items-center gap-2"><i class="ph-fill ph-users text-purple-500"></i> Efetivo</h3>
                <span class="text-sm font-bold bg-purple-50 text-purple-700 px-3 py-1 rounded-full">Total: ${totalWorkforce}</span>
            </div>
            
            ${l.workforce.map((w,i) => `
                <div class="flex flex-col md:flex-row gap-2 mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div class="flex flex-col w-full">
                        <label class="text-[10px] uppercase font-bold text-gray-400 mb-1">Empresa</label>
                        <select ${da} class="w-full border rounded-lg p-2.5 text-sm bg-white outline-none" onchange="window.updateSubItem('workforce',${i},'company',this.value)">
                            <option value="" disabled ${!w.company?'selected':''}>Selecionar...</option>
                            ${state.currentProjectData.companies?.map(c=>`<option value="${c.name}" ${w.company===c.name?'selected':''}>${c.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex gap-2 w-full">
                        <div class="flex-1">
                            <label class="text-[10px] uppercase font-bold text-gray-400 mb-1">Função</label>
                            <input ${da} class="w-full border rounded-lg p-2.5 text-sm" list="roles-list" value="${w.role}" onchange="window.updateSubItem('workforce',${i},'role',this.value)">
                        </div>
                        <div class="w-20">
                            <label class="text-[10px] uppercase font-bold text-gray-400 mb-1">Qtd</label>
                            <input ${da} class="w-full border rounded-lg p-2.5 text-sm text-center" type="number" value="${w.count}" onchange="window.updateSubItem('workforce',${i},'count',this.value)">
                        </div>
                        <button onclick="window.removeSubItem('workforce',${i})" class="${hi} p-2 text-red-500 bg-white border border-red-100 rounded-lg"><i class="ph-bold ph-trash"></i></button>
                    </div>
                </div>
            `).join('')}

            <div class="flex gap-2 mt-2 ${hi}">
                <button onclick="window.addSubItem('workforce',{company:'',role:'',count:''})" class="flex-1 py-3 border-2 border-dashed border-blue-200 text-blue-600 rounded-xl font-medium hover:bg-blue-50">+ Adicionar</button>
                <button onclick="window.copyPreviousWorkforce()" class="flex-1 py-3 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 flex items-center justify-center gap-2"><i class="ph-bold ph-copy"></i> Copiar Anterior</button>
            </div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 class="font-bold text-gray-700 mb-3 flex items-center gap-2"><i class="ph-fill ph-clipboard-text text-slate-500"></i> Ocorrências</h3>
            <textarea ${da} class="w-full border border-gray-200 rounded-xl p-3 h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none" onchange="window.updateDailyLogData('events',this.value)" placeholder="Descreva o dia...">${l.events}</textarea>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 class="font-bold text-gray-700 mb-3 flex items-center gap-2"><i class="ph-fill ph-camera text-blue-500"></i> Fotos</h3>
            <div class="grid grid-cols-4 gap-2">
                ${l.photos.map((p,i)=>`<div class="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"><img src="${p.url}" class="w-full h-full object-cover"><button ${hi} onclick="window.removeSubItem('photos',${i})" class="absolute top-0.5 right-0.5 bg-red-500 text-white p-1 rounded-full"><i class="ph-bold ph-x text-[10px]"></i></button></div>`).join('')}
                <label class="${hi} border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer aspect-square"><i class="ph-bold ph-camera-plus"></i><input type="file" class="hidden" multiple accept="image/*" onchange="window.handlePhotoUpload(this, 'photos')"></label>
            </div>
        </div>
    </div>`;
}

window.generateChecklistHTML_Original = function() { return `<div class="max-w-4xl mx-auto w-full bg-white p-5 rounded-xl shadow-sm border border-gray-100"><h2 class="font-bold text-xl mb-4 text-gray-800 flex items-center gap-2"><i class="ph-fill ph-check-square text-green-500"></i> Checklist</h2>${state.role !== 'client' ? `<div class="flex gap-2 mb-6"><input id="new-todo" class="border rounded-xl p-3 flex-1 outline-none" placeholder="Nova pendência..."><button onclick="window.addChecklist()" class="bg-blue-600 text-white px-5 rounded-xl font-bold"><i class="ph-bold ph-plus"></i></button></div>` : ''}<div class="space-y-1">${state.currentProjectData.checklist.map(i=>`<div class="flex items-center gap-3 p-3 border rounded-lg ${i.completed?'bg-gray-50 border-gray-100':'bg-white border-gray-200'}"><button ${state.role === 'client' ? 'disabled' : ''} onclick="window.toggleChecklist(${i.id})" class="text-2xl ${i.completed?'text-green-500':'text-gray-300'}"><i class="${i.completed?'ph-fill ph-check-circle':'ph-bold ph-circle'}"></i></button><span class="flex-1 ${i.completed?'line-through text-gray-400':'text-gray-700 font-medium'}">${i.text}</span>${state.role !== 'client' ? `<button onclick="window.deleteChecklistItem(${i.id})" class="text-gray-300 hover:text-red-500 p-2"><i class="ph-bold ph-trash"></i></button>`:''}</div>`).join('')}</div></div>`; }
window.generateCompaniesHTML_Original = function() { return `<div class="max-w-4xl mx-auto w-full bg-white p-5 rounded-xl shadow-sm border border-gray-100"><h2 class="font-bold text-xl mb-4 text-gray-800">Empresas</h2>${state.role==='master'?`<div class="bg-blue-50 p-4 rounded-xl mb-6"><label class="text-xs font-bold text-blue-800 uppercase mb-2 block">Nova Empresa</label><div class="flex gap-2"><input id="new-company-name" class="border border-blue-200 rounded-lg p-3 flex-1 outline-none"><button onclick="window.addCompany()" class="bg-blue-600 text-white px-6 rounded-lg font-bold">Salvar</button></div></div>`:''}<div class="divide-y divide-gray-100">${state.currentProjectData.companies.map(c=>`<div class="flex justify-between items-center p-4 hover:bg-gray-50"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">${c.name.charAt(0)}</div><span class="font-medium text-gray-700">${c.name}</span></div>${state.role==='master'?`<button onclick="window.deleteCompany('${c.id}')" class="text-gray-300 hover:text-red-500 p-2"><i class="ph-bold ph-trash"></i></button>`:''}</div>`).join('')}</div></div>`; }
window.generateFinancialHTML = function() {
    const financials = state.financialConfigMode ? state.tempFinancial : (state.currentProjectData.financial || []);
    const fmt = (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
    if (state.financialConfigMode) return window.generateFinancialHTML_Config(financials);
    let accPlanned = 0; let accMeasured = 0;
    const rowsHTML = financials.map(f => {
        const planned = f.planned || 0; const measured = f.measured || 0; accPlanned += planned; accMeasured += measured; const diff = accMeasured - accPlanned;
        return `<tr class="hover:bg-gray-50"><td class="p-3 font-medium text-gray-700 border-r border-gray-100">${f.month}</td><td class="p-3 text-right text-gray-500 border-r border-gray-100">${fmt(planned)}</td><td class="p-3 text-right font-bold text-blue-700 bg-blue-50/30 border-r border-blue-50">${fmt(accPlanned)}</td><td class="p-2 text-right border-r border-gray-100 w-32 cursor-pointer hover:bg-gray-50" onclick="window.startEditingFinancial(${f.id})">${state.editingFinancialId === f.id ? `<input type="number" id="fin-input-${f.id}" value="${f.measured || ''}" onblur="window.stopEditingFinancial(${f.id}, this.value)" class="w-full text-right bg-white border border-blue-500 rounded p-1.5 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800 text-xs">` : `<span class="font-bold text-gray-800 text-xs">${measured !== 0 ? fmt(measured) : '-'}</span>`}</td><td class="p-3 text-right font-bold text-gray-700 bg-gray-50/50 border-r border-gray-100">${fmt(accMeasured)}</td><td class="p-3 text-right font-bold ${diff < 0 ? 'text-red-500' : 'text-green-500'}">${fmt(diff)}</td></tr>`;
    }).join('');
    return `<div class="max-w-4xl mx-auto w-full"><div class="flex justify-between items-center mb-6"><h2 class="font-bold text-xl text-gray-800 flex items-center gap-2"><i class="ph-fill ph-currency-dollar text-green-600"></i> Financeiro</h2>${state.role === 'master' ? `<button onclick="window.toggleFinancialConfig()" class="p-2 text-gray-500 hover:text-blue-600 bg-white shadow-sm border border-gray-100 rounded-lg"><i class="ph-bold ph-gear text-xl"></i></button>` : ''}</div><div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50 text-gray-500 font-bold uppercase text-xs border-b border-gray-200"><tr><th rowspan="2" class="p-3 text-left bg-gray-50 border-r border-gray-200">Mês</th><th colspan="2" class="p-2 text-center bg-blue-50/50 border-r border-blue-100 text-blue-800">Previsto</th><th colspan="2" class="p-2 text-center bg-green-50/50 border-r border-green-100 text-green-800">Real</th><th rowspan="2" class="p-3 text-right bg-gray-50 text-gray-700">Desvio Acum.</th></tr><tr><th class="p-2 text-right bg-blue-50/30 border-r border-blue-100">Mensal</th><th class="p-2 text-right bg-blue-50/30 border-r border-blue-100">Acumulado</th><th class="p-2 text-right bg-green-50/30 border-r border-green-100">Faturado</th><th class="p-2 text-right bg-green-50/30 border-r border-green-100">Acumulado</th></tr></thead><tbody class="divide-y divide-gray-100">${rowsHTML}</tbody></table></div></div></div>`;
}
window.generateFinancialHTML_Config = function(financials) {
    return `<div class="max-w-4xl mx-auto w-full"><div class="bg-blue-50 p-5 rounded-xl border border-blue-100 mb-4 animate-fade-in"><h3 class="font-bold text-blue-900 mb-3 text-sm uppercase">Gerador de Cronograma</h3><div class="flex gap-2 mb-4 items-end bg-white p-3 rounded-lg border border-blue-100 shadow-sm"><div class="flex-1"><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Início</label><input type="month" id="fin-start-month" class="w-full border rounded-lg p-2 text-sm outline-none"></div><div class="flex-1"><label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Fim</label><input type="month" id="fin-end-month" class="w-full border rounded-lg p-2 text-sm outline-none"></div><button onclick="window.generateFinancialGrid()" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm h-[38px]">Gerar</button></div>${financials.map(f => `<div class="flex justify-between p-2 bg-white mb-1 rounded border border-gray-100"><span>${f.month}</span><input type="number" value="${f.planned||''}" onchange="window.updateTempFinancial(${f.id}, 'planned', this.value)" class="text-right border bg-gray-50 rounded p-1 w-32"></div>`).join('')}<div class="flex justify-end gap-2 border-t border-blue-200 pt-4"><button onclick="window.toggleFinancialConfig()" class="text-gray-500 font-bold text-sm px-4">Cancelar</button><button onclick="window.saveFinancialConfig()" class="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Salvar</button></div></div></div>`;
}
window.generateReportPreviewHTML_Original = function() {
    const p = state.currentProjectData; const y = state.calendarViewDate.getFullYear(); const m = state.calendarViewDate.getMonth();
    const prefix = `${y}-${String(m+1).padStart(2,'0')}`;
    const logs = Object.keys(state.logsCache).filter(k=>k.startsWith(prefix)).sort().map(k=>({date:k, ...state.logsCache[k]}));
    return `<div class="max-w-4xl mx-auto w-full pb-20"><div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-20 flex justify-between items-center mb-4"><button onclick="window.switchTab('calendar')" class="text-gray-500 p-2"><i class="ph-bold ph-arrow-left text-xl"></i> Voltar</button><button onclick="window.generateMonthlyReport()" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2"><i class="ph-bold ph-printer"></i> Imprimir</button></div><div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100"><h1 class="text-2xl font-bold">Relatório: ${state.calendarViewDate.toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}</h1><p>${p.name}</p><div class="mt-4 space-y-4">${logs.map(l => `<div class="border-b pb-2"><h3 class="font-bold">${l.date}</h3><p class="text-sm">${l.events||'N/A'}</p></div>`).join('')}</div></div></div>`;
}
window.generateMonthlyReport = () => { setTimeout(() => window.print(), 500); };
