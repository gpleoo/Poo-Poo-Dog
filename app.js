/**
 * Poo-Poo Dog Tracker - Application Core
 * Copyright (c) 2024-2025 Giampietro Leonoro & Monica Amato. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 * Unauthorized copying, modification, distribution, or use of this software,
 * via any medium, is strictly prohibited without explicit written permission.
 *
 * This software is protected by copyright law and international treaties.
 * Unauthorized reproduction or distribution of this software, or any portion of it,
 * may result in severe civil and criminal penalties, and will be prosecuted
 * to the maximum extent possible under the law.
 *
 * For licensing information, contact: Giampietro Leonoro & Monica Amato
 * DO NOT REMOVE THIS COPYRIGHT NOTICE
 *
 * Application Version: 1.0.0
 * Authors: Giampietro Leonoro, Monica Amato
 * Created: 2024
 */

// Copyright Protection - DO NOT REMOVE
const _COPYRIGHT_ = {
    authors: ["Giampietro Leonoro", "Monica Amato"],
    year: "2024-2025",
    rights: "All Rights Reserved",
    protected: true,
    version: "1.0.0"
};

// Poo-Poo Dog Tracker App - Complete Version with Dog Profile
class PoopTracker {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.userPosition = null;
        this.poops = [];
        this.poopMarkers = [];
        this.dogPhoto = null;
        this.dogProfile = {};
        this.savedNotes = [];
        this.foodHistory = [];
        this.watchId = null;
        this.activeFilters = { period: 'all', type: 'all', food: 'all' };
        this.pendingPoopData = null;
        this.isFirstTime = true;

        // Chart instances
        this.typeChartInstance = null;
        this.timelineChartInstance = null;
        this.foodChartInstance = null;

        // Copyright Protection
        this._copyright = _COPYRIGHT_;
        this._verifyCopyright();

        this.init();
    }

    _verifyCopyright() {
        // Add copyright to console
        console.log('%c© 2024-2025 Giampietro Leonoro & Monica Amato',
            'font-size: 14px; font-weight: bold; color: #f093fb; text-shadow: 1px 1px 2px black;');
        console.log('%cTutti i Diritti Riservati - All Rights Reserved',
            'font-size: 12px; color: #667eea;');
        console.log('%cUnauthorized use, reproduction or distribution is prohibited and subject to legal action.',
            'font-size: 10px; color: #ff6b6b;');
    }

    init() {
        this.initMap();
        this.loadSavedData();
        this.initGeolocation();
        this.setupEventListeners();
        this.updatePoopCounter();
        this.updateStats();
        this.updateDogName();

        // Apri profilo cane se è la prima volta
        if (this.isFirstTime && !this.dogProfile.name) {
            setTimeout(() => {
                this.openDogProfileModal();
                this.showToast('👋 Benvenuto! Inserisci i dati del tuo cane per iniziare');
            }, 1000);
        }

        // Aggiorna promemoria
        this.updateReminders();
    }

    initMap() {
        this.map = L.map('map', {
            zoomControl: true,
            attributionControl: false
        }).setView([45.4642, 9.1900], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(this.map);

        this.map.zoomControl.setPosition('topright');
    }

    initGeolocation() {
        if (!navigator.geolocation) {
            this.showToast('❌ Geolocalizzazione non supportata dal browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                this.map.setView([this.userPosition.lat, this.userPosition.lng], 16);
                this.updateUserMarker();
                this.showToast('📍 Posizione trovata!');
            },
            (error) => {
                console.error('Errore geolocalizzazione:', error);
                this.showToast('⚠️ Impossibile ottenere la posizione');
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0
            }
        );

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                this.updateUserMarker();
            },
            (error) => {
                console.error('Errore watch position:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    }

    updateUserMarker() {
        if (!this.userPosition) return;

        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        const iconHtml = this.dogPhoto
            ? `<div class="dog-marker" style="background-image: url('${this.dogPhoto}'); background-size: cover; background-position: center;"></div>`
            : `<div class="dog-marker" style="display: flex; align-items: center; justify-content: center; font-size: 2em;">🐕</div>`;

        const userIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-user-marker',
            iconSize: [80, 80],
            iconAnchor: [40, 40]
        });

        this.userMarker = L.marker([this.userPosition.lat, this.userPosition.lng], {
            icon: userIcon,
            zIndexOffset: 1000
        }).addTo(this.map);

        this.userMarker.on('click', () => {
            this.openDogPhotoModal();
        });

        const dogName = this.dogProfile.name || 'il tuo cane';
        const popupText = this.dogPhoto
            ? `<b>🐕 Tu e ${dogName} siete qui!</b><br>Clicca per cambiare la foto`
            : `<b>🐕 Tu e ${dogName} siete qui!</b><br>Clicca per aggiungere la foto`;
        this.userMarker.bindPopup(popupText);
    }

    findNearbyFreePosition(lat, lng) {
        const MIN_DISTANCE = 0.00003;
        const MAX_ATTEMPTS = 8;

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            let testLat = lat;
            let testLng = lng;

            if (i > 0) {
                const angle = (i / MAX_ATTEMPTS) * 2 * Math.PI;
                const distance = MIN_DISTANCE * (1 + i * 0.3);
                testLat += Math.cos(angle) * distance;
                testLng += Math.sin(angle) * distance;
            }

            const isFree = !this.poops.some(p => {
                const dist = Math.sqrt(
                    Math.pow(p.lat - testLat, 2) +
                    Math.pow(p.lng - testLng, 2)
                );
                return dist < MIN_DISTANCE;
            });

            if (isFree) {
                return { lat: testLat, lng: testLng };
            }
        }

        return { lat, lng };
    }

    addPoop() {
        if (!this.userPosition) {
            this.showToast('⚠️ Aspetta che la posizione venga rilevata!');
            return;
        }

        const position = this.findNearbyFreePosition(
            this.userPosition.lat,
            this.userPosition.lng
        );

        this.pendingPoopData = {
            lat: position.lat,
            lng: position.lng,
            timestamp: new Date().toISOString()
        };

        this.openPoopDetailsModal();
    }

    savePoopWithDetails(details) {
        if (!this.pendingPoopData) return;

        const poop = {
            id: Date.now(),
            ...this.pendingPoopData,
            ...details
        };

        this.poops.push(poop);

        // Salva cibo nella history
        if (details.food && details.food.trim() && !this.foodHistory.includes(details.food.trim())) {
            this.foodHistory.push(details.food.trim());
        }

        this.addPoopMarker(poop);
        this.saveData();
        this.updatePoopCounter();
        this.updateStats();
        this.updateFoodSuggestions();
        this.updateFoodFilter();
        this.showToast('💩 Cacca registrata con successo!');

        this.pendingPoopData = null;
    }

    getPoopIcon(type) {
        // Mappatura colori:
        // healthy → poop-happy (marrone #8B4513)
        // soft, diarrhea → poop-sad (marrone chiaro #D2B48C)
        // hard → poop-hard (marrone scurissimo #3D2817)
        // blood, mucus → poop-sick (rosso #FF4444)

        if (type === 'healthy') {
            return 'poop-happy';
        } else if (type === 'soft' || type === 'diarrhea') {
            return 'poop-sad';
        } else if (type === 'hard') {
            return 'poop-hard';
        } else if (type === 'blood' || type === 'mucus') {
            return 'poop-sick';
        } else {
            return 'poop-sad'; // default
        }
    }

    addPoopMarker(poop) {
        const iconName = this.getPoopIcon(poop.type);

        const poopIcon = L.divIcon({
            html: `<svg class="poop-svg-icon"><use href="#${iconName}"></use></svg>`,
            className: 'custom-poop-marker',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });

        const marker = L.marker([poop.lat, poop.lng], {
            icon: poopIcon
        }).addTo(this.map);

        const date = new Date(poop.timestamp);
        const dateStr = date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const typeLabels = {
            healthy: '✅ Sana',
            soft: '⚠️ Morbida',
            diarrhea: '💧 Diarrea',
            hard: '🪨 Dura',
            blood: '🩸 Con Sangue',
            mucus: '🫧 Con Muco'
        };

        let popupContent = `
            <div style="text-align: center; font-family: 'Fredoka', cursive;">
                <b>💩 Dettagli Cacca</b><br>
                <div style="margin: 10px 0; text-align: left; font-size: 0.95em;">
                    <b>Stato:</b> ${typeLabels[poop.type] || poop.type}<br>
                    <b>Dimensione:</b> ${poop.size}<br>
                    <b>Colore:</b> ${poop.color}<br>
                    <b>Odore:</b> ${poop.smell}<br>`;

        if (poop.food) {
            popupContent += `<b>🍖 Cibo:</b> ${poop.food}<br>`;
        }
        if (poop.hoursSinceMeal) {
            popupContent += `<b>⏰ Ore dal pasto:</b> ${poop.hoursSinceMeal}h<br>`;
        }
        if (poop.notes) {
            popupContent += `<b>Note:</b> ${poop.notes}<br>`;
        }

        popupContent += `
                </div>
                📅 ${dateStr}<br>
                <button onclick="app.deletePoop(${poop.id})" style="
                    margin-top: 10px;
                    padding: 5px 15px;
                    background: #f5576c;
                    color: white;
                    border: none;
                    border-radius: 15px;
                    cursor: pointer;
                    font-family: 'Fredoka', cursive;
                    font-weight: 600;
                ">🗑️ Rimuovi</button>
            </div>
        `;

        marker.bindPopup(popupContent);
        this.poopMarkers.push({ id: poop.id, marker: marker });
    }

    deletePoop(poopId) {
        this.poops = this.poops.filter(p => p.id !== poopId);

        const poopMarker = this.poopMarkers.find(pm => pm.id === poopId);
        if (poopMarker) {
            this.map.removeLayer(poopMarker.marker);
            this.poopMarkers = this.poopMarkers.filter(pm => pm.id !== poopId);
        }

        this.saveData();
        this.updatePoopCounter();
        this.updateStats();
        this.showToast('🗑️ Cacca rimossa!');
        this.updateRecentPoopsList();
    }

    clearAllPoops() {
        if (this.poops.length === 0) {
            this.showToast('😊 Non ci sono cacche da rimuovere!');
            return;
        }

        const dogName = this.dogProfile.name || 'il cane';
        if (confirm(`Sei sicuro di voler rimuovere tutte le ${this.poops.length} cacche di ${dogName}? 💩`)) {
            this.poopMarkers.forEach(pm => {
                this.map.removeLayer(pm.marker);
            });

            this.poops = [];
            this.poopMarkers = [];
            this.saveData();
            this.updatePoopCounter();
            this.updateStats();
            this.showToast('✨ Tutte le cacche sono state rimosse!');
            this.updateRecentPoopsList();
        }
    }

    centerOnUser() {
        if (!this.userPosition) {
            this.showToast('⚠️ Posizione non ancora rilevata!');
            return;
        }

        this.map.setView([this.userPosition.lat, this.userPosition.lng], 16, {
            animate: true,
            duration: 0.5
        });
        this.showToast('📍 Centrato sulla tua posizione!');
    }

    updatePoopCounter() {
        document.getElementById('poopCount').textContent = this.poops.length;
    }

    updateDogName() {
        if (this.dogProfile.name) {
            const title = document.getElementById('appTitle');
            title.textContent = `🐕 ${this.dogProfile.name} - Poo Tracker 💩`;
        }
    }

    updateStats() {
        const totalPoops = this.poops.length;
        const healthyPoops = this.poops.filter(p => p.type === 'healthy').length;
        const problemPoops = this.poops.filter(p =>
            ['diarrhea', 'blood', 'mucus'].includes(p.type)
        ).length;

        document.getElementById('totalPoops').textContent = totalPoops;
        document.getElementById('healthyPoops').textContent = healthyPoops;
        document.getElementById('problemPoops').textContent = problemPoops;
    }

    updateFoodSuggestions() {
        const datalist = document.getElementById('foodSuggestions');
        datalist.innerHTML = this.foodHistory.map(food =>
            `<option value="${food}">`
        ).join('');
    }

    updateFoodFilter() {
        const select = document.getElementById('filterFood');
        const currentValue = select.value;

        select.innerHTML = '<option value="all">Tutti i Cibi</option>' +
            this.foodHistory.map(food =>
                `<option value="${food}">${food}</option>`
            ).join('');

        if (this.foodHistory.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    updateSavedNotesList() {
        const select = document.getElementById('savedNotes');
        select.innerHTML = '<option value="">Seleziona nota salvata o scrivi nuova...</option>' +
            this.savedNotes.map((note, index) =>
                `<option value="${index}">${note.substring(0, 50)}${note.length > 50 ? '...' : ''}</option>`
            ).join('');
    }

    applyFilters() {
        const period = document.getElementById('filterPeriod').value;
        const type = document.getElementById('filterType').value;
        const food = document.getElementById('filterFood').value;

        this.activeFilters = { period, type, food };

        this.poopMarkers.forEach(pm => {
            this.map.removeLayer(pm.marker);
        });
        this.poopMarkers = [];

        const filteredPoops = this.getFilteredPoops();
        filteredPoops.forEach(poop => {
            this.addPoopMarker(poop);
        });

        this.showToast(`📊 Filtri applicati: ${filteredPoops.length} cacche visualizzate`);
        this.updateRecentPoopsList();
    }

    getFilteredPoops() {
        let filtered = [...this.poops];

        // Filtro periodo
        if (this.activeFilters.period !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filtered = filtered.filter(p => {
                const poopDate = new Date(p.timestamp);
                const poopDay = new Date(poopDate.getFullYear(), poopDate.getMonth(), poopDate.getDate());

                switch(this.activeFilters.period) {
                    case 'today':
                        return poopDay.getTime() === today.getTime();
                    case 'yesterday':
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        return poopDay.getTime() === yesterday.getTime();
                    case 'week':
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return poopDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(today);
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        return poopDate >= monthAgo;
                    default:
                        return true;
                }
            });
        }

        // Filtro tipo
        if (this.activeFilters.type !== 'all') {
            filtered = filtered.filter(p => p.type === this.activeFilters.type);
        }

        // Filtro cibo
        if (this.activeFilters.food !== 'all') {
            filtered = filtered.filter(p => p.food === this.activeFilters.food);
        }

        return filtered;
    }

    resetFilters() {
        this.activeFilters = { period: 'all', type: 'all', food: 'all' };
        document.getElementById('filterPeriod').value = 'all';
        document.getElementById('filterType').value = 'all';
        document.getElementById('filterFood').value = 'all';
        this.applyFilters();
    }

    updateRecentPoopsList() {
        const list = document.getElementById('recentPoopsList');
        const filteredPoops = this.getFilteredPoops();
        const recentPoops = filteredPoops.slice(-10).reverse();

        if (recentPoops.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666;">Nessuna cacca registrata</p>';
            return;
        }

        const typeLabels = {
            healthy: '✅ Sana',
            soft: '⚠️ Morbida',
            diarrhea: '💧 Diarrea',
            hard: '🪨 Dura',
            blood: '🩸 Con Sangue',
            mucus: '🫧 Con Muco'
        };

        list.innerHTML = recentPoops.map(poop => {
            const date = new Date(poop.timestamp);
            const dateStr = date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            let foodInfo = poop.food ? `<br><small>🍖 ${poop.food}</small>` : '';

            return `
                <div class="poop-list-item">
                    <div class="poop-item-info">
                        <div class="poop-item-date">${dateStr}</div>
                        <div class="poop-item-status">${typeLabels[poop.type]}${foodInfo}</div>
                    </div>
                    <div class="poop-item-actions">
                        <button class="btn-small" onclick="app.centerOnPoop(${poop.id})">📍</button>
                        <button class="btn-small" onclick="app.deletePoop(${poop.id})">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    centerOnPoop(poopId) {
        const poop = this.poops.find(p => p.id === poopId);
        if (poop) {
            this.map.setView([poop.lat, poop.lng], 18, { animate: true });
            const marker = this.poopMarkers.find(pm => pm.id === poopId);
            if (marker) {
                marker.marker.openPopup();
            }
            this.closeFiltersModal();
        }
    }

    // Modal Management
    openPoopDetailsModal() {
        document.getElementById('poopDetailsModal').classList.add('active');
        document.getElementById('poopDetailsForm').reset();
        this.updateSavedNotesList();
        this.updateFoodSuggestions();
    }

    closePoopDetailsModal() {
        document.getElementById('poopDetailsModal').classList.remove('active');
        this.pendingPoopData = null;
    }

    openFiltersModal() {
        document.getElementById('filtersModal').classList.add('active');
        this.updateStats();
        this.updateRecentPoopsList();
        this.updateFoodFilter();
        this.generateHealthCharts();
    }

    closeFiltersModal() {
        document.getElementById('filtersModal').classList.remove('active');
    }

    openDogPhotoModal() {
        const modal = document.getElementById('dogPhotoModal');
        modal.classList.add('active');

        const preview = document.getElementById('dogPhotoPreview');
        if (this.dogPhoto) {
            preview.innerHTML = `<img src="${this.dogPhoto}" alt="Dog Photo">`;
        } else {
            preview.innerHTML = '<span class="placeholder-text">Clicca per aggiungere foto 🐕</span>';
        }
    }

    closeDogPhotoModal() {
        document.getElementById('dogPhotoModal').classList.remove('active');
    }

    openDogProfileModal() {
        document.getElementById('dogProfileModal').classList.add('active');
        this.loadDogProfileToForm();
    }

    closeDogProfileModal() {
        document.getElementById('dogProfileModal').classList.remove('active');
    }

    loadDogProfileToForm() {
        document.getElementById('dogName').value = this.dogProfile.name || '';
        document.getElementById('dogBirthdate').value = this.dogProfile.birthdate || '';
        document.getElementById('dogWeight').value = this.dogProfile.weight || '';
        document.getElementById('dogBreed').value = this.dogProfile.breed || '';
        document.getElementById('dogGender').value = this.dogProfile.gender || '';
        document.getElementById('dogColor').value = this.dogProfile.color || '';
        document.getElementById('dogMicrochip').value = this.dogProfile.microchip || '';
        document.getElementById('dogChronicDiseases').value = this.dogProfile.chronicDiseases || '';
        document.getElementById('dogFoodAllergies').value = this.dogProfile.foodAllergies || '';
        document.getElementById('dogMedicineAllergies').value = this.dogProfile.medicineAllergies || '';
        document.getElementById('dogCurrentMedicine').value = this.dogProfile.currentMedicine || '';
        document.getElementById('dogSurgeries').value = this.dogProfile.surgeries || '';
        document.getElementById('vetName').value = this.dogProfile.vetName || '';
        document.getElementById('vetPhone').value = this.dogProfile.vetPhone || '';
        document.getElementById('vetEmail').value = this.dogProfile.vetEmail || '';
        document.getElementById('vetAddress').value = this.dogProfile.vetAddress || '';
        document.getElementById('lastVaccination').value = this.dogProfile.lastVaccination || '';
        document.getElementById('nextVaccination').value = this.dogProfile.nextVaccination || '';
        document.getElementById('lastAntiparasitic').value = this.dogProfile.lastAntiparasitic || '';
        document.getElementById('nextAntiparasitic').value = this.dogProfile.nextAntiparasitic || '';
        document.getElementById('lastFleaTick').value = this.dogProfile.lastFleaTick || '';
        document.getElementById('nextFleaTick').value = this.dogProfile.nextFleaTick || '';
        document.getElementById('vaccinationNotes').value = this.dogProfile.vaccinationNotes || '';
        document.getElementById('dogGeneralNotes').value = this.dogProfile.generalNotes || '';
    }

    saveDogProfile() {
        this.dogProfile = {
            name: document.getElementById('dogName').value.trim(),
            birthdate: document.getElementById('dogBirthdate').value,
            weight: document.getElementById('dogWeight').value,
            breed: document.getElementById('dogBreed').value.trim(),
            gender: document.getElementById('dogGender').value,
            color: document.getElementById('dogColor').value.trim(),
            microchip: document.getElementById('dogMicrochip').value.trim(),
            chronicDiseases: document.getElementById('dogChronicDiseases').value.trim(),
            foodAllergies: document.getElementById('dogFoodAllergies').value.trim(),
            medicineAllergies: document.getElementById('dogMedicineAllergies').value.trim(),
            currentMedicine: document.getElementById('dogCurrentMedicine').value.trim(),
            surgeries: document.getElementById('dogSurgeries').value.trim(),
            vetName: document.getElementById('vetName').value.trim(),
            vetPhone: document.getElementById('vetPhone').value.trim(),
            vetEmail: document.getElementById('vetEmail').value.trim(),
            vetAddress: document.getElementById('vetAddress').value.trim(),
            lastVaccination: document.getElementById('lastVaccination').value,
            nextVaccination: document.getElementById('nextVaccination').value,
            lastAntiparasitic: document.getElementById('lastAntiparasitic').value,
            nextAntiparasitic: document.getElementById('nextAntiparasitic').value,
            lastFleaTick: document.getElementById('lastFleaTick').value,
            nextFleaTick: document.getElementById('nextFleaTick').value,
            vaccinationNotes: document.getElementById('vaccinationNotes').value.trim(),
            generalNotes: document.getElementById('dogGeneralNotes').value.trim()
        };

        this.saveData();
        this.updateDogName();
        this.updateUserMarker();
        this.updateReminders();
        this.closeDogProfileModal();
        this.showToast(`✅ Profilo di ${this.dogProfile.name || 'il cane'} salvato!`);
    }

    // Reminders System
    updateReminders() {
        const reminders = this.getUpcomingReminders();
        const badge = document.getElementById('remindersBadge');

        if (reminders.length > 0) {
            badge.textContent = reminders.length;
            badge.style.display = 'block';

            // Mostra notifica se ci sono promemoria urgenti
            const urgentReminders = reminders.filter(r => r.urgency === 'urgent');
            if (urgentReminders.length > 0) {
                this.showToast(`⚠️ ${urgentReminders.length} promemoria urgente/i!`);
            }
        } else {
            badge.style.display = 'none';
        }
    }

    getUpcomingReminders() {
        const reminders = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const checkDate = (dateStr, label) => {
            if (!dateStr) return null;

            const date = new Date(dateStr);
            date.setHours(0, 0, 0, 0);

            const diffTime = date - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 30) {
                let urgency = 'ok';
                if (diffDays < 0) {
                    urgency = 'urgent';
                } else if (diffDays <= 7) {
                    urgency = 'urgent';
                } else if (diffDays <= 14) {
                    urgency = 'warning';
                }

                return {
                    label,
                    date: dateStr,
                    daysLeft: diffDays,
                    urgency
                };
            }
            return null;
        };

        const nextVacc = checkDate(this.dogProfile.nextVaccination, '💉 Prossima Vaccinazione');
        const nextAnti = checkDate(this.dogProfile.nextAntiparasitic, '🐛 Prossimo Antiparassitario');
        const nextFlea = checkDate(this.dogProfile.nextFleaTick, '🦟 Prossimo Antipulci/Zecche');

        if (nextVacc) reminders.push(nextVacc);
        if (nextAnti) reminders.push(nextAnti);
        if (nextFlea) reminders.push(nextFlea);

        // Ordina per urgenza e giorni rimanenti
        reminders.sort((a, b) => {
            const urgencyOrder = { urgent: 0, warning: 1, ok: 2 };
            if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            }
            return a.daysLeft - b.daysLeft;
        });

        return reminders;
    }

    openRemindersModal() {
        document.getElementById('remindersModal').classList.add('active');
        this.updateRemindersList();
    }

    closeRemindersModal() {
        document.getElementById('remindersModal').classList.remove('active');
    }

    updateRemindersList() {
        const list = document.getElementById('remindersList');
        const reminders = this.getUpcomingReminders();

        if (reminders.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #666;">
                    <div style="font-size: 3em; margin-bottom: 10px;">✅</div>
                    <p>Nessun promemoria in scadenza nei prossimi 30 giorni!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = reminders.map(reminder => {
            const date = new Date(reminder.date);
            const dateStr = date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            let daysText = '';
            if (reminder.daysLeft < 0) {
                daysText = `<strong>SCADUTO ${Math.abs(reminder.daysLeft)} giorni fa!</strong>`;
            } else if (reminder.daysLeft === 0) {
                daysText = '<strong>OGGI!</strong>';
            } else if (reminder.daysLeft === 1) {
                daysText = '<strong>Domani</strong>';
            } else {
                daysText = `Tra ${reminder.daysLeft} giorni`;
            }

            return `
                <div class="reminder-item reminder-${reminder.urgency}">
                    <div class="reminder-label">${reminder.label}</div>
                    <div class="reminder-date">${dateStr}</div>
                    <div class="reminder-days">${daysText}</div>
                </div>
            `;
        }).join('');
    }

    // Health Charts System
    generateHealthCharts() {
        // Verifica disponibilità Chart.js
        if (typeof Chart === 'undefined') {
            console.error('Chart.js non disponibile');
            return;
        }

        // Attendi che il modal sia visibile prima di generare i grafici
        setTimeout(() => {
            this.generateTypeChart();
            this.generateTimelineChart();
            this.generateFoodCorrelationChart();
        }, 100);
    }

    generateTypeChart() {
        const ctx = document.getElementById('typeChart');
        if (!ctx) {
            console.error('Canvas typeChart non trovato');
            return;
        }

        // Distruggi grafico esistente se presente
        if (this.typeChartInstance) {
            this.typeChartInstance.destroy();
        }

        // Conta i tipi di cacca
        const typeCounts = {
            healthy: 0,
            soft: 0,
            diarrhea: 0,
            hard: 0,
            blood: 0,
            mucus: 0
        };

        this.poops.forEach(poop => {
            if (typeCounts.hasOwnProperty(poop.type)) {
                typeCounts[poop.type]++;
            }
        });

        const typeLabels = {
            healthy: '✅ Sana',
            soft: '⚠️ Morbida',
            diarrhea: '💧 Diarrea',
            hard: '🪨 Dura',
            blood: '🩸 Con Sangue',
            mucus: '🫧 Con Muco'
        };

        const data = {
            labels: Object.keys(typeCounts).map(key => typeLabels[key]),
            datasets: [{
                data: Object.values(typeCounts),
                backgroundColor: [
                    'rgba(102, 187, 106, 0.8)',  // healthy - verde
                    'rgba(255, 167, 38, 0.8)',   // soft - arancione
                    'rgba(239, 83, 80, 0.8)',    // diarrhea - rosso
                    'rgba(156, 39, 176, 0.8)',   // hard - viola
                    'rgba(244, 67, 54, 0.8)',    // blood - rosso scuro
                    'rgba(33, 150, 243, 0.8)'    // mucus - blu
                ],
                borderColor: '#fff',
                borderWidth: 2
            }]
        };

        this.typeChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Fredoka' },
                            padding: 10
                        }
                    },
                    title: {
                        display: true,
                        text: 'Distribuzione Tipi di Cacca',
                        font: { family: 'Fredoka', size: 16, weight: 'bold' }
                    }
                }
            }
        });
    }

    generateTimelineChart() {
        const ctx = document.getElementById('timelineChart');
        if (!ctx) {
            console.error('Canvas timelineChart non trovato');
            return;
        }

        // Distruggi grafico esistente se presente
        if (this.timelineChartInstance) {
            this.timelineChartInstance.destroy();
        }

        // Ultimi 30 giorni
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

        const dailyData = {};
        const dailyProblems = {};

        // Inizializza tutti i giorni
        for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
            const dateKey = new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
            dailyData[dateKey] = 0;
            dailyProblems[dateKey] = 0;
        }

        // Conta cacche per giorno
        this.poops.forEach(poop => {
            const poopDate = new Date(poop.timestamp);
            if (poopDate >= thirtyDaysAgo) {
                const dateKey = poopDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
                if (dailyData.hasOwnProperty(dateKey)) {
                    dailyData[dateKey]++;
                    if (['diarrhea', 'blood', 'mucus'].includes(poop.type)) {
                        dailyProblems[dateKey]++;
                    }
                }
            }
        });

        const labels = Object.keys(dailyData);
        const totals = Object.values(dailyData);
        const problems = Object.values(dailyProblems);

        this.timelineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Totale Cacche',
                        data: totals,
                        borderColor: 'rgba(102, 126, 234, 1)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Con Problemi',
                        data: problems,
                        borderColor: 'rgba(239, 83, 80, 1)',
                        backgroundColor: 'rgba(239, 83, 80, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { family: 'Fredoka' } }
                    },
                    title: {
                        display: true,
                        text: 'Andamento Ultimi 30 Giorni',
                        font: { family: 'Fredoka', size: 16, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: { family: 'Fredoka' }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: { family: 'Fredoka', size: 9 }
                        }
                    }
                }
            }
        });
    }

    generateFoodCorrelationChart() {
        const ctx = document.getElementById('foodChart');
        if (!ctx) {
            console.error('Canvas foodChart non trovato');
            return;
        }

        // Distruggi grafico esistente se presente
        if (this.foodChartInstance) {
            this.foodChartInstance.destroy();
        }

        // Conta cacche e problemi per cibo
        const foodStats = {};

        this.poops.forEach(poop => {
            if (poop.food && poop.food.trim()) {
                const food = poop.food.trim();
                if (!foodStats[food]) {
                    foodStats[food] = { total: 0, problems: 0 };
                }
                foodStats[food].total++;
                if (['diarrhea', 'blood', 'mucus'].includes(poop.type)) {
                    foodStats[food].problems++;
                }
            }
        });

        // Calcola percentuale problemi e ordina
        const foodData = Object.entries(foodStats)
            .map(([food, stats]) => ({
                food,
                total: stats.total,
                problemRate: (stats.problems / stats.total) * 100
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);  // Top 5 cibi

        if (foodData.length === 0) {
            // Nessun cibo registrato
            this.foodChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Nessun dato'],
                    datasets: [{
                        label: 'Tasso di Problemi (%)',
                        data: [0],
                        backgroundColor: 'rgba(200, 200, 200, 0.5)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Correlazione Cibo-Problemi (Top 5 Cibi)',
                            font: { family: 'Fredoka', size: 16, weight: 'bold' }
                        }
                    }
                }
            });
            return;
        }

        const labels = foodData.map(d => d.food);
        const problemRates = foodData.map(d => d.problemRate);
        const colors = problemRates.map(rate => {
            if (rate > 50) return 'rgba(239, 83, 80, 0.8)';  // rosso
            if (rate > 20) return 'rgba(255, 167, 38, 0.8)'; // arancione
            return 'rgba(102, 187, 106, 0.8)';  // verde
        });

        this.foodChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tasso di Problemi (%)',
                    data: problemRates,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace('0.8', '1')),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Correlazione Cibo-Problemi (Top 5 Cibi)',
                        font: { family: 'Fredoka', size: 16, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const foodItem = foodData[context.dataIndex];
                                return [
                                    `Tasso problemi: ${context.parsed.y.toFixed(1)}%`,
                                    `Totale cacche: ${foodItem.total}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            font: { family: 'Fredoka' }
                        },
                        title: {
                            display: true,
                            text: 'Percentuale Problemi',
                            font: { family: 'Fredoka' }
                        }
                    },
                    x: {
                        ticks: {
                            font: { family: 'Fredoka' }
                        }
                    }
                }
            }
        });
    }

    // PDF Export System
    generatePdfReport() {
        if (this.poops.length === 0) {
            this.showToast('⚠️ Nessuna cacca da esportare!');
            return;
        }

        try {
            // Verifica disponibilità jsPDF
            if (!window.jspdf || !window.jspdf.jsPDF) {
                console.error('jsPDF non disponibile');
                this.showToast('❌ Libreria PDF non caricata');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const dogName = this.dogProfile.name || 'Cane';
            const today = new Date().toLocaleDateString('it-IT');

            // Traduzioni valori in italiano
            const genderLabels = {
                'male': 'Maschio',
                'female': 'Femmina',
                '': 'Non specificato'
            };

            const sizeLabels = {
                'small': 'Piccola',
                'medium': 'Media',
                'large': 'Grande'
            };

            const colorLabels = {
                'normal': 'Marrone Normale',
                'light': 'Chiaro',
                'dark': 'Scuro',
                'green': 'Verdastro',
                'yellow': 'Giallastro',
                'red': 'Rossastro'
            };

            const smellLabels = {
                'normal': 'Normale',
                'strong': 'Molto Forte',
                'unusual': 'Insolito'
            };

            // Intestazione
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(`Report Salute - ${dogName}`, 105, 20, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generato il: ${today}`, 105, 28, { align: 'center' });

            let yPos = 40;

            // Informazioni Cane
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Informazioni Cane', 14, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            const dogInfo = [
                ['Nome:', this.dogProfile.name || 'N/D'],
                ['Razza:', this.dogProfile.breed || 'N/D'],
                ['Sesso:', genderLabels[this.dogProfile.gender] || 'N/D'],
                ['Data di Nascita:', this.dogProfile.birthdate || 'N/D'],
                ['Peso:', this.dogProfile.weight ? `${this.dogProfile.weight} kg` : 'N/D'],
                ['Colore:', this.dogProfile.color || 'N/D'],
                ['Microchip:', this.dogProfile.microchip || 'N/D']
            ];

            dogInfo.forEach(([label, value]) => {
                doc.text(label, 14, yPos);
                doc.text(value, 60, yPos);
                yPos += 6;
            });

            yPos += 4;

            // Informazioni Sanitarie
            if (this.dogProfile.chronicDiseases || this.dogProfile.foodAllergies ||
                this.dogProfile.medicineAllergies || this.dogProfile.currentMedicine || this.dogProfile.surgeries) {

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Informazioni Sanitarie', 14, yPos);
                yPos += 8;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');

                if (this.dogProfile.chronicDiseases) {
                    doc.text('Malattie Croniche:', 14, yPos);
                    const lines = doc.splitTextToSize(this.dogProfile.chronicDiseases, 170);
                    doc.text(lines, 14, yPos + 6);
                    yPos += 6 + (lines.length * 6);
                }

                if (this.dogProfile.foodAllergies) {
                    doc.text('Allergie Alimentari:', 14, yPos);
                    const lines = doc.splitTextToSize(this.dogProfile.foodAllergies, 170);
                    doc.text(lines, 14, yPos + 6);
                    yPos += 6 + (lines.length * 6);
                }

                if (this.dogProfile.medicineAllergies) {
                    doc.text('Allergie Farmaci:', 14, yPos);
                    const lines = doc.splitTextToSize(this.dogProfile.medicineAllergies, 170);
                    doc.text(lines, 14, yPos + 6);
                    yPos += 6 + (lines.length * 6);
                }

                if (this.dogProfile.currentMedicine) {
                    doc.text('Farmaci Attuali:', 14, yPos);
                    const lines = doc.splitTextToSize(this.dogProfile.currentMedicine, 170);
                    doc.text(lines, 14, yPos + 6);
                    yPos += 6 + (lines.length * 6);
                }

                if (this.dogProfile.surgeries) {
                    doc.text('Interventi Chirurgici:', 14, yPos);
                    const lines = doc.splitTextToSize(this.dogProfile.surgeries, 170);
                    doc.text(lines, 14, yPos + 6);
                    yPos += 6 + (lines.length * 6);
                }

                yPos += 4;
            }

            // Veterinario
            if (this.dogProfile.vetName || this.dogProfile.vetPhone || this.dogProfile.vetEmail) {
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Veterinario di Riferimento', 14, yPos);
                yPos += 8;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');

                if (this.dogProfile.vetName) {
                    doc.text('Nome:', 14, yPos);
                    doc.text(this.dogProfile.vetName, 60, yPos);
                    yPos += 6;
                }

                if (this.dogProfile.vetPhone) {
                    doc.text('Telefono:', 14, yPos);
                    doc.text(this.dogProfile.vetPhone, 60, yPos);
                    yPos += 6;
                }

                if (this.dogProfile.vetEmail) {
                    doc.text('Email:', 14, yPos);
                    doc.text(this.dogProfile.vetEmail, 60, yPos);
                    yPos += 6;
                }

                if (this.dogProfile.vetAddress) {
                    doc.text('Indirizzo:', 14, yPos);
                    const lines = doc.splitTextToSize(this.dogProfile.vetAddress, 130);
                    doc.text(lines, 60, yPos);
                    yPos += lines.length * 6;
                }

                yPos += 4;
            }

            // Statistiche
            if (yPos > 230) {
                doc.addPage();
                yPos = 20;
            }

            const totalPoops = this.poops.length;
            const healthyPoops = this.poops.filter(p => p.type === 'healthy').length;
            const problemPoops = this.poops.filter(p => ['diarrhea', 'blood', 'mucus'].includes(p.type)).length;
            const healthyPercentage = totalPoops > 0 ? Math.round((healthyPoops / totalPoops) * 100) : 0;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Statistiche Salute', 14, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            doc.text(`Totale Cacche Registrate: ${totalPoops}`, 14, yPos);
            yPos += 6;
            doc.text(`Cacche Sane: ${healthyPoops} (${healthyPercentage}%)`, 14, yPos);
            yPos += 6;
            doc.text(`Cacche con Problemi: ${problemPoops}`, 14, yPos);
            yPos += 10;

            // Tabella Ultime Cacche
            doc.addPage();

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Storico Recente (Ultimi 50 Registrazioni)', 105, 20, { align: 'center' });

            const typeLabels = {
                healthy: 'Sana',
                soft: 'Morbida',
                diarrhea: 'Diarrea',
                hard: 'Dura',
                blood: 'Con Sangue',
                mucus: 'Con Muco'
            };

            const tableData = this.poops.slice(-50).reverse().map(poop => {
                const date = new Date(poop.timestamp);
                const dateStr = date.toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return [
                    dateStr,
                    typeLabels[poop.type] || poop.type,
                    sizeLabels[poop.size] || poop.size || 'N/D',
                    colorLabels[poop.color] || poop.color || 'N/D',
                    smellLabels[poop.smell] || poop.smell || 'N/D',
                    poop.food || 'N/D',
                    poop.notes ? poop.notes.substring(0, 25) + (poop.notes.length > 25 ? '...' : '') : ''
                ];
            });

            doc.autoTable({
                startY: 30,
                head: [['Data/Ora', 'Tipo', 'Dim.', 'Colore', 'Odore', 'Cibo', 'Note']],
                body: tableData,
                styles: { fontSize: 7, cellPadding: 1.5 },
                headStyles: { fillColor: [102, 126, 234], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 250] },
                margin: { top: 30, bottom: 30 },
                didDrawPage: (data) => {
                    // Footer copyright su ogni pagina
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(100);
                    doc.text(
                        '© 2024-2025 Giampietro Leonoro & Monica Amato - All Rights Reserved',
                        105,
                        doc.internal.pageSize.height - 10,
                        { align: 'center' }
                    );
                }
            });

            // Salva PDF
            const fileName = `${dogName}_Report_Salute_${today.replace(/\//g, '-')}.pdf`;
            doc.save(fileName);

            this.showToast('✅ PDF generato con successo!');
        } catch (error) {
            console.error('Errore generazione PDF:', error);
            this.showToast('❌ Errore nella generazione del PDF');
        }
    }

    setupEventListeners() {
        // Bottone aggiungi cacca
        document.getElementById('addPoopBtn').addEventListener('click', () => {
            this.addPoop();
        });

        // Bottone centra mappa
        document.getElementById('centerMapBtn').addEventListener('click', () => {
            this.centerOnUser();
        });

        // Bottone filtri
        document.getElementById('filterBtn').addEventListener('click', () => {
            this.openFiltersModal();
        });

        // Bottone cancella tutto
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllPoops();
        });

        // Bottone profilo cane
        document.getElementById('dogProfileBtn').addEventListener('click', () => {
            this.openDogProfileModal();
        });

        // Bottone promemoria
        document.getElementById('remindersBtn').addEventListener('click', () => {
            this.openRemindersModal();
        });

        // Chiudi promemoria modal
        document.getElementById('closeReminders').addEventListener('click', () => {
            this.closeRemindersModal();
        });

        // Apri profilo da promemoria
        document.getElementById('openProfileFromReminders').addEventListener('click', () => {
            this.closeRemindersModal();
            this.openDogProfileModal();
        });

        // Form dettagli cacca
        document.getElementById('poopDetailsForm').addEventListener('submit', (e) => {
            e.preventDefault();

            const noteText = document.getElementById('poopNotes').value.trim();
            const saveNoteChecked = document.getElementById('saveNote').checked;

            if (saveNoteChecked && noteText && !this.savedNotes.includes(noteText)) {
                this.savedNotes.push(noteText);
                this.saveData();
            }

            const details = {
                type: document.getElementById('poopType').value,
                size: document.getElementById('poopSize').value,
                color: document.getElementById('poopColor').value,
                smell: document.getElementById('poopSmell').value,
                food: document.getElementById('poopFood').value.trim(),
                hoursSinceMeal: document.getElementById('poopHoursSinceMeal').value,
                notes: noteText
            };

            this.savePoopWithDetails(details);
            this.closePoopDetailsModal();
        });

        document.getElementById('cancelPoopDetails').addEventListener('click', () => {
            this.closePoopDetailsModal();
        });

        // Selettore note salvate
        document.getElementById('savedNotes').addEventListener('change', (e) => {
            const index = e.target.value;
            if (index !== '' && this.savedNotes[index]) {
                document.getElementById('poopNotes').value = this.savedNotes[index];
            }
        });

        // Form profilo cane
        document.getElementById('dogProfileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDogProfile();
        });

        document.getElementById('cancelDogProfile').addEventListener('click', () => {
            this.closeDogProfileModal();
        });

        // Filtri modal
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('resetFilters').addEventListener('click', () => {
            this.resetFilters();
        });

        document.getElementById('closeFilters').addEventListener('click', () => {
            this.closeFiltersModal();
        });

        // Esporta PDF
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            this.generatePdfReport();
        });

        // Modal foto cane
        const dogPhotoPreview = document.getElementById('dogPhotoPreview');
        const dogPhotoInput = document.getElementById('dogPhotoInput');

        dogPhotoPreview.addEventListener('click', () => {
            dogPhotoInput.click();
        });

        dogPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.getElementById('dogPhotoPreview');
                    preview.innerHTML = `<img src="${event.target.result}" alt="Dog Photo">`;
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('saveDogPhoto').addEventListener('click', () => {
            const file = dogPhotoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.dogPhoto = event.target.result;
                    this.saveData();
                    this.updateUserMarker();
                    this.closeDogPhotoModal();
                    this.showToast('📸 Foto salvata!');
                };
                reader.readAsDataURL(file);
            } else if (this.dogPhoto) {
                this.closeDogPhotoModal();
            } else {
                this.showToast('⚠️ Seleziona prima una foto!');
            }
        });

        document.getElementById('removeDogPhoto').addEventListener('click', () => {
            this.dogPhoto = null;
            this.saveData();
            this.updateUserMarker();
            this.closeDogPhotoModal();
            this.showToast('🗑️ Foto rimossa!');
        });

        // Chiudi modal cliccando fuori
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal')) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    showToast(message) {
        const toast = document.getElementById('infoToast');
        const toastMessage = document.getElementById('toastMessage');

        toastMessage.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    saveData() {
        const data = {
            poops: this.poops,
            dogPhoto: this.dogPhoto,
            dogProfile: this.dogProfile,
            savedNotes: this.savedNotes,
            foodHistory: this.foodHistory,
            isFirstTime: false
        };
        localStorage.setItem('poopTrackerData', JSON.stringify(data));
    }

    loadSavedData() {
        const savedData = localStorage.getItem('poopTrackerData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.poops = data.poops || [];
                this.dogPhoto = data.dogPhoto || null;
                this.dogProfile = data.dogProfile || {};
                this.savedNotes = data.savedNotes || [];
                this.foodHistory = data.foodHistory || [];
                this.isFirstTime = data.isFirstTime !== false;

                // Ricrea i marker per le cacche salvate
                this.poops.forEach(poop => {
                    this.addPoopMarker(poop);
                });

                if (this.poops.length > 0) {
                    this.showToast(`📊 Caricate ${this.poops.length} cacche salvate!`);
                }
            } catch (error) {
                console.error('Errore nel caricamento dei dati:', error);
            }
        }
    }
}

// Inizializza l'app quando il DOM è pronto
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PoopTracker();
});
