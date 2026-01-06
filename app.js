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
        this.markerClusterGroup = null; // Cluster group for poop markers
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

        // GPS/Privacy settings
        this.gpsEnabled = true;
        this.gpsPermissionStatus = 'unknown'; // 'granted', 'denied', 'prompt', 'unknown'

        // Auto-center e Zoom settings
        this.autoCenter = true; // Auto-centra mappa quando l'utente si muove
        this.preferredZoom = 16; // Zoom preferito dall'utente

        // Protezione loop infinito
        this.isUpdatingPosition = false;
        this.lastPositionUpdate = 0;
        this.positionUpdateThrottle = 1000; // Minimum 1 second between updates

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

    playPlopSound() {
        try {
            // Crea AudioContext per generare suono sintetico
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Oscillatore principale per il "fart"
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Configurazione suono "fart" divertente - PIÙ SORDO E PIÙ LUNGO
            oscillator.type = 'sawtooth'; // Onda più ruvida per effetto scorreggia
            oscillator.frequency.setValueAtTime(70, audioContext.currentTime); // Frequenza più bassa (era 100)

            // Variazioni di frequenza per effetto scorreggia - frequenze più basse
            oscillator.frequency.linearRampToValueAtTime(50, audioContext.currentTime + 0.08);
            oscillator.frequency.linearRampToValueAtTime(85, audioContext.currentTime + 0.18);
            oscillator.frequency.linearRampToValueAtTime(40, audioContext.currentTime + 0.32);
            oscillator.frequency.linearRampToValueAtTime(65, audioContext.currentTime + 0.5);

            // Envelope per volume più alto - durata estesa
            gainNode.gain.setValueAtTime(0.6, audioContext.currentTime); // Volume alto
            gainNode.gain.linearRampToValueAtTime(0.55, audioContext.currentTime + 0.15);
            gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.3);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.55);

            // Riproduci - durata estesa a 550ms (era 350ms)
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.55);

            // Chiudi context dopo riproduzione
            setTimeout(() => {
                audioContext.close();
            }, 600);
        } catch (error) {
            console.log('Audio non supportato o errore riproduzione:', error);
        }
    }

    init() {
        this.initMap();
        this.loadSavedData();
        this.loadPrivacySettings();
        this.loadMapSettings(); // Carica zoom preferito
        this.checkGPSPermissions();
        this.initGeolocation();
        this.setupEventListeners();
        this.setupMapListeners(); // Listener per drag/zoom
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

        // Inizializza il cluster group con icone personalizzate
        this.markerClusterGroup = L.markerClusterGroup({
            iconCreateFunction: (cluster) => this.createClusterIcon(cluster),
            maxClusterRadius: 80, // Raggruppa marker entro 80 pixel
            spiderfyOnMaxZoom: true, // Espandi i marker quando si raggiunge il max zoom
            showCoverageOnHover: false, // Non mostrare il raggio del cluster
            zoomToBoundsOnClick: true // Zoom quando si clicca sul cluster
        });

        this.map.addLayer(this.markerClusterGroup);
    }

    setupMapListeners() {
        // Quando utente trascina la mappa manualmente → disattiva auto-center
        this.map.on('dragstart', () => {
            if (this.autoCenter) {
                this.autoCenter = false;
                console.log('Auto-center disattivato - utente ha mosso la mappa');
            }
        });

        // Quando utente cambia zoom → salva nuovo zoom preferito
        // Protezione: ignora se stiamo aggiornando la posizione automaticamente
        this.map.on('zoomend', () => {
            if (this.isUpdatingPosition) {
                return; // Ignora eventi zoom durante aggiornamenti automatici
            }

            const newZoom = this.map.getZoom();
            if (newZoom !== this.preferredZoom) {
                this.preferredZoom = newZoom;
                this.saveMapSettings();
                console.log('Zoom preferito aggiornato:', this.preferredZoom);
            }
        });
    }

    initGeolocation() {
        if (!navigator.geolocation) {
            this.gpsPermissionStatus = 'unsupported';
            this.showToast('❌ Geolocalizzazione non supportata dal browser');
            this.updateGPSStatus();
            return;
        }

        if (!this.gpsEnabled) {
            console.log('GPS disabilitato dall\'utente');
            return;
        }

        // Richiedi SEMPRE il permesso ad ogni avvio
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.gpsPermissionStatus = 'granted';
                this.userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                // Imposta flag per prevenire loop durante inizializzazione
                this.isUpdatingPosition = true;

                // Usa zoom preferito dall'utente
                this.map.setView([this.userPosition.lat, this.userPosition.lng], this.preferredZoom);

                // Reset flag dopo inizializzazione
                setTimeout(() => {
                    this.isUpdatingPosition = false;
                }, 500);

                this.updateUserMarker();
                this.updateGPSStatus();
                this.showToast('📍 Posizione trovata!');
            },
            (error) => {
                console.error('Errore geolocalizzazione:', error);
                this.handleGeolocationError(error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );

        // Watch position solo se permessi concessi
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                // Throttle: ignora aggiornamenti troppo frequenti (prevenzione loop)
                const now = Date.now();
                if (now - this.lastPositionUpdate < this.positionUpdateThrottle) {
                    return;
                }
                this.lastPositionUpdate = now;

                this.userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                this.updateUserMarker();

                // Auto-center mappa se attivo (come Google Maps)
                if (this.autoCenter) {
                    // Imposta flag per prevenire loop con eventi mappa
                    this.isUpdatingPosition = true;

                    this.map.setView(
                        [this.userPosition.lat, this.userPosition.lng],
                        this.preferredZoom, // Mantiene zoom preferito
                        {
                            animate: true,
                            duration: 0.3 // Animazione smooth
                        }
                    );

                    // Reset flag dopo animazione completata
                    setTimeout(() => {
                        this.isUpdatingPosition = false;
                    }, 500);
                }
            },
            (error) => {
                console.error('Errore watch position:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000, // Cache position for 5 seconds (invece di 0)
                timeout: 10000 // Aumentato timeout per ridurre frequenza
            }
        );
    }

    handleGeolocationError(error) {
        switch(error.code) {
            case error.PERMISSION_DENIED:
                this.gpsPermissionStatus = 'denied';
                this.showToast('❌ Permesso GPS negato. Vai in Impostazioni per riattivarlo.');
                break;
            case error.POSITION_UNAVAILABLE:
                this.gpsPermissionStatus = 'unavailable';
                this.showToast('⚠️ Posizione non disponibile');
                break;
            case error.TIMEOUT:
                this.gpsPermissionStatus = 'timeout';
                this.showToast('⏱️ Timeout GPS. Riprova.');
                break;
            default:
                this.gpsPermissionStatus = 'error';
                this.showToast('❌ Errore GPS sconosciuto');
        }
        this.updateGPSStatus();
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

        // Riproduci suono "plop" divertente
        this.playPlopSound();

        const position = this.findNearbyFreePosition(
            this.userPosition.lat,
            this.userPosition.lng
        );

        this.pendingPoopData = {
            lat: position.lat,
            lng: position.lng,
            timestamp: new Date().toISOString(),
            isManual: false // Cacca con GPS
        };

        this.openPoopDetailsModal();
    }

    addManualPoop() {
        // Inserimento manuale senza GPS
        // Riproduci suono
        this.playPlopSound();

        this.pendingPoopData = {
            lat: null,
            lng: null,
            timestamp: null, // Sarà impostato dal form con data/ora personalizzata
            isManual: true // Cacca manuale senza GPS
        };

        this.openPoopDetailsModal();
        this.showToast('📝 Inserimento manuale - specifica data e ora');
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

        // Aggiungi marker sulla mappa SOLO se NON è manuale
        if (!poop.isManual) {
            this.addPoopMarker(poop);
        }

        this.saveData();
        this.updatePoopCounter();
        this.updateStats();
        this.updateFoodSuggestions();
        this.updateFoodFilter();

        if (poop.isManual) {
            this.showToast('📝 Cacca manuale registrata! (solo statistiche)');
        } else {
            this.showToast('💩 Cacca registrata con successo!');
        }

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

    createClusterIcon(cluster) {
        // Ottieni tutti i marker nel cluster
        const markers = cluster.getAllChildMarkers();
        const count = markers.length;

        // Conta i tipi di cacche nel cluster
        const typeCounts = {};
        markers.forEach(marker => {
            // Recupera il tipo dalla cacca associata al marker
            const poopId = marker.options.poopId;
            const poop = this.poops.find(p => p.id === poopId);
            if (poop && poop.type) {
                typeCounts[poop.type] = (typeCounts[poop.type] || 0) + 1;
            }
        });

        // Trova il tipo più comune
        let mostCommonType = 'healthy';
        let maxCount = 0;
        for (const [type, count] of Object.entries(typeCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommonType = type;
            }
        }

        // Ottieni l'icona corrispondente al tipo più comune
        const iconName = this.getPoopIcon(mostCommonType);

        // Crea l'icona del cluster con la forma della cacca e il numero
        const html = `
            <div class="custom-cluster-icon" style="position: relative;">
                <svg class="poop-svg-icon-cluster" style="width: 60px; height: 60px;">
                    <use href="#${iconName}"></use>
                </svg>
                <div class="cluster-count" style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border: 2px solid #333;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 12px;
                    color: #333;
                    font-family: 'Fredoka', cursive;
                ">${count}</div>
            </div>
        `;

        return L.divIcon({
            html: html,
            className: 'custom-cluster-marker',
            iconSize: L.point(60, 60),
            iconAnchor: [30, 30]
        });
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
            icon: poopIcon,
            poopId: poop.id // Aggiungi l'ID per il clustering
        });

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
                📅 ${dateStr}
            </div>
        `;

        marker.bindPopup(popupContent);

        // Aggiungi il marker al cluster group invece che direttamente alla mappa
        this.markerClusterGroup.addLayer(marker);

        this.poopMarkers.push({ id: poop.id, marker: marker });
    }

    deletePoop(poopId) {
        // Trova la cacca da cancellare
        const poopToDelete = this.poops.find(p => p.id === poopId);
        if (!poopToDelete) {
            console.error('Cacca non trovata con id:', poopId);
            this.showToast('❌ Errore: cacca non trovata!');
            return;
        }

        // Conferma cancellazione
        const dateStr = new Date(poopToDelete.timestamp).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        if (!confirm(`Vuoi davvero cancellare questa cacca?\n\n📅 ${dateStr}\n\nQuesta azione non può essere ripristinata.`)) {
            return; // Cancellazione annullata
        }

        // Chiudi tutti i popup aperti sulla mappa
        this.map.closePopup();

        // Rimuovi la cacca dall'array (SOLO quella con l'id specificato)
        this.poops = this.poops.filter(p => p.id !== poopId);

        // Rimuovi il marker dal cluster group
        const poopMarker = this.poopMarkers.find(pm => pm.id === poopId);
        if (poopMarker) {
            this.markerClusterGroup.removeLayer(poopMarker.marker);
            this.poopMarkers = this.poopMarkers.filter(pm => pm.id !== poopId);
        }

        // Aggiorna tutto
        this.saveData();
        this.updatePoopCounter();
        this.updateStats();
        this.showToast('🗑️ Cacca rimossa con successo!');
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
                this.markerClusterGroup.removeLayer(pm.marker);
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

        // Riattiva auto-center quando utente preme il bottone
        this.autoCenter = true;

        // Imposta flag per prevenire loop
        this.isUpdatingPosition = true;

        this.map.setView([this.userPosition.lat, this.userPosition.lng], this.preferredZoom, {
            animate: true,
            duration: 0.5
        });

        // Reset flag dopo animazione
        setTimeout(() => {
            this.isUpdatingPosition = false;
        }, 600);

        this.showToast('📍 Auto-center attivato!');
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

        // Rimuovi tutti i marker dal cluster group
        this.poopMarkers.forEach(pm => {
            this.markerClusterGroup.removeLayer(pm.marker);
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
            let manualBadge = poop.isManual ? `<br><small style="color: #999;">📝 Manuale</small>` : '';

            // Bottone mappa disabilitato per cacche manuali
            let mapButton = poop.isManual
                ? `<button class="btn-small" disabled style="opacity: 0.3;" title="Cacca manuale - non sulla mappa">📍</button>`
                : `<button class="btn-small" onclick="app.centerOnPoop(${poop.id})">📍</button>`;

            return `
                <div class="poop-list-item">
                    <div class="poop-item-info">
                        <div class="poop-item-date">${dateStr}</div>
                        <div class="poop-item-status">${typeLabels[poop.type]}${foodInfo}${manualBadge}</div>
                    </div>
                    <div class="poop-item-actions">
                        ${mapButton}
                        <button class="btn-small" onclick="app.deletePoop(${poop.id})">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    centerOnPoop(poopId) {
        const poop = this.poops.find(p => p.id === poopId);
        if (poop) {
            // Disattiva auto-center quando utente naviga manualmente
            this.autoCenter = false;

            // Imposta flag per prevenire loop
            this.isUpdatingPosition = true;

            this.map.setView([poop.lat, poop.lng], 18, { animate: true });

            // Reset flag dopo animazione
            setTimeout(() => {
                this.isUpdatingPosition = false;
            }, 500);

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

        // Mostra/nascondi campi data/ora per inserimento manuale
        const manualSection = document.getElementById('manualDateTimeSection');
        const dateInput = document.getElementById('poopDate');
        const timeInput = document.getElementById('poopTime');

        if (this.pendingPoopData && this.pendingPoopData.isManual) {
            // Inserimento manuale - mostra campi data/ora
            manualSection.style.display = 'block';

            // Imposta data/ora corrente di default
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeStr = now.toTimeString().slice(0, 5); // HH:MM

            dateInput.value = dateStr;
            timeInput.value = timeStr;
            dateInput.required = true;
            timeInput.required = true;

            // Imposta max data/ora a oggi (non può essere nel futuro)
            dateInput.max = dateStr;
        } else {
            // Inserimento GPS - nascondi campi data/ora
            manualSection.style.display = 'none';
            dateInput.required = false;
            timeInput.required = false;
        }
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
        try {
            console.log('saveDogProfile() chiamato');

            // Validazione: nome cane obbligatorio
            const dogNameInput = document.getElementById('dogName');
            if (!dogNameInput) {
                console.error('Campo dogName non trovato nel DOM');
                this.showToast('❌ Errore: campo nome non trovato');
                return;
            }

            const dogName = dogNameInput.value.trim();
            if (!dogName) {
                this.showToast('⚠️ Inserisci almeno il nome del cane!');
                console.log('Nome cane vuoto, validazione fallita');
                return;
            }

            console.log('Raccolta dati profilo cane:', dogName);

            this.dogProfile = {
                name: dogName,
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

            console.log('Profilo raccolto, salvataggio in corso...');
            this.saveData();
            console.log('Dati salvati, aggiornamento UI...');

            this.updateDogName();
            this.updateUserMarker();
            this.updateReminders();
            this.closeDogProfileModal();

            console.log('Profilo salvato con successo');
            this.showToast(`✅ Profilo di ${this.dogProfile.name} salvato!`);
        } catch (error) {
            console.error('ERRORE in saveDogProfile():', error);
            console.error('Stack trace:', error.stack);
            this.showToast(`❌ Errore salvataggio: ${error.message}`);
        }
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

    // Privacy/Settings Modal Management
    openSettingsModal() {
        document.getElementById('settingsModal').classList.add('active');
        this.updateGPSStatus();
        this.updateGPSToggle();
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    // GPS Permission Management
    async checkGPSPermissions() {
        if (!navigator.permissions) {
            console.log('Permissions API non supportata');
            return;
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            this.gpsPermissionStatus = result.state;
            this.updateGPSStatus();

            result.addEventListener('change', () => {
                this.gpsPermissionStatus = result.state;
                this.updateGPSStatus();
            });
        } catch (error) {
            console.log('Errore check permessi GPS:', error);
        }
    }

    updateGPSStatus() {
        const statusInfo = document.getElementById('gpsStatusInfo');
        const statusIcon = document.getElementById('gpsStatusIcon');
        const statusText = document.getElementById('gpsStatusText');
        const requestBtn = document.getElementById('requestGPSBtn');
        const instructions = document.getElementById('gpsInstructions');

        if (!statusInfo) return;

        if (this.gpsPermissionStatus === 'granted' && this.gpsEnabled) {
            statusInfo.className = 'gps-status';
            statusIcon.textContent = '✅';
            statusText.textContent = 'Stato GPS: Attivo e Funzionante';
            requestBtn.style.display = 'none';
            instructions.style.display = 'none';
        } else if (this.gpsPermissionStatus === 'denied') {
            statusInfo.className = 'gps-status denied';
            statusIcon.textContent = '❌';
            statusText.textContent = 'Stato GPS: Permesso Negato';
            requestBtn.style.display = 'block';
            instructions.style.display = 'block';
        } else if (!this.gpsEnabled) {
            statusInfo.className = 'gps-status denied';
            statusIcon.textContent = '⚠️';
            statusText.textContent = 'Stato GPS: Disabilitato';
            requestBtn.style.display = 'none';
            instructions.style.display = 'none';
        } else {
            statusInfo.className = 'gps-status';
            statusIcon.textContent = '📍';
            statusText.textContent = 'Stato GPS: In Attesa...';
            requestBtn.style.display = 'none';
            instructions.style.display = 'none';
        }
    }

    updateGPSToggle() {
        const toggle = document.getElementById('gpsToggle');
        if (toggle) {
            toggle.checked = this.gpsEnabled;
        }
    }

    toggleGPS() {
        this.gpsEnabled = !this.gpsEnabled;
        this.savePrivacySettings();
        this.updateGPSToggle();

        if (this.gpsEnabled) {
            this.showToast('✅ GPS attivato');
            this.initGeolocation();
        } else {
            this.showToast('⚠️ GPS disabilitato');
            if (this.watchId) {
                navigator.geolocation.clearWatch(this.watchId);
                this.watchId = null;
            }
        }

        this.updateGPSStatus();
    }

    requestGPSPermission() {
        this.showToast('📍 Richiesta permessi GPS in corso...');
        this.initGeolocation();
    }

    // Privacy Data Management
    loadPrivacySettings() {
        const settings = localStorage.getItem('privacySettings');
        if (settings) {
            try {
                const parsed = JSON.parse(settings);
                this.gpsEnabled = parsed.gpsEnabled !== false;
            } catch (error) {
                console.error('Errore caricamento impostazioni privacy:', error);
            }
        }
    }

    savePrivacySettings() {
        const settings = {
            gpsEnabled: this.gpsEnabled
        };
        localStorage.setItem('privacySettings', JSON.stringify(settings));
    }

    loadMapSettings() {
        const settings = localStorage.getItem('mapSettings');
        if (settings) {
            try {
                const parsed = JSON.parse(settings);
                // Carica zoom preferito (default 16 se non presente)
                this.preferredZoom = parsed.preferredZoom || 16;
                console.log('Zoom preferito caricato:', this.preferredZoom);
            } catch (error) {
                console.error('Errore caricamento impostazioni mappa:', error);
                this.preferredZoom = 16;
            }
        }
    }

    saveMapSettings() {
        const settings = {
            preferredZoom: this.preferredZoom
        };
        localStorage.setItem('mapSettings', JSON.stringify(settings));
    }

    clearAllData() {
        const dogName = this.dogProfile.name || 'il cane';

        if (!confirm(`⚠️ SEI SICURO?\n\nQuesta azione cancellerà PERMANENTEMENTE:\n\n• Tutte le ${this.poops.length} cacche registrate\n• Il profilo di ${dogName}\n• Tutte le note salvate\n• Lo storico cibi\n• TUTTI i dati dell'app\n\nQuesta operazione NON È REVERSIBILE!\n\nDigita OK per confermare.`)) {
            return;
        }

        const confirm2 = prompt('Digita "CANCELLA" in maiuscolo per confermare la cancellazione totale:');

        if (confirm2 === 'CANCELLA') {
            // Rimuovi marker dal cluster group
            this.poopMarkers.forEach(pm => {
                this.markerClusterGroup.removeLayer(pm.marker);
            });

            // Cancella dati
            this.poops = [];
            this.poopMarkers = [];
            this.dogPhoto = null;
            this.dogProfile = {};
            this.savedNotes = [];
            this.foodHistory = [];
            this.isFirstTime = true;

            // Cancella localStorage
            localStorage.removeItem('poopTrackerData');

            // Aggiorna UI
            this.updatePoopCounter();
            this.updateStats();
            this.updateDogName();
            this.closeSettingsModal();

            this.showToast('🗑️ Tutti i dati sono stati cancellati!');

            // Reindirizza dopo 2 secondi
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            this.showToast('❌ Cancellazione annullata');
        }
    }

    async exportBackup() {
        try {
            // Crea oggetto con tutti i dati
            const backupData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                dogName: this.dogProfile.name || 'Sconosciuto',
                data: {
                    poops: this.poops,
                    dogPhoto: this.dogPhoto,
                    dogProfile: this.dogProfile,
                    savedNotes: this.savedNotes,
                    foodHistory: this.foodHistory,
                    isFirstTime: this.isFirstTime
                }
            };

            // Converti in JSON
            const jsonString = JSON.stringify(backupData, null, 2);

            // Crea nome file con data
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const dogName = this.dogProfile.name || 'PooPoo';
            const fileName = `${dogName}_Backup_${dateStr}.json`;

            // Prova a usare File System Access API (permette scelta cartella)
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{
                            description: 'Backup JSON',
                            accept: { 'application/json': ['.json'] }
                        }]
                    });

                    const writable = await handle.createWritable();
                    await writable.write(jsonString);
                    await writable.close();

                    this.showToast(`💾 Backup salvato: ${fileName}`);
                } catch (err) {
                    // Utente ha annullato la scelta
                    if (err.name === 'AbortError') {
                        this.showToast('❌ Salvataggio annullato');
                    } else {
                        throw err; // Altri errori vanno al fallback
                    }
                }
            } else {
                // Fallback per browser che non supportano showSaveFilePicker
                // (Firefox, Safari mobile, etc.)
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.showToast(`💾 Backup scaricato: ${fileName}`);
            }
        } catch (error) {
            console.error('Errore esportazione backup:', error);
            this.showToast('❌ Errore durante l\'esportazione!');
        }
    }

    importBackup() {
        // Apri file picker
        const input = document.getElementById('importBackupInput');
        input.click();
    }

    processBackupFile(file) {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const backupData = JSON.parse(e.target.result);

                // Validazione base
                if (!backupData.version || !backupData.data) {
                    this.showToast('❌ File backup non valido!');
                    return;
                }

                const dogName = backupData.dogName || 'Sconosciuto';
                const poopsCount = backupData.data.poops?.length || 0;
                const exportDate = new Date(backupData.exportDate).toLocaleDateString('it-IT');

                // Conferma import
                if (!confirm(`📂 Importa Backup?\n\n🐕 Cane: ${dogName}\n💩 Cacche: ${poopsCount}\n📅 Data backup: ${exportDate}\n\n⚠️ ATTENZIONE: Questo sovrascriverà tutti i dati attuali!\n\nVuoi procedere?`)) {
                    this.showToast('❌ Importazione annullata');
                    return;
                }

                // Rimuovi vecchi marker dal cluster group
                this.poopMarkers.forEach(pm => {
                    this.markerClusterGroup.removeLayer(pm.marker);
                });
                this.poopMarkers = [];

                // Importa dati
                this.poops = backupData.data.poops || [];
                this.dogPhoto = backupData.data.dogPhoto || null;
                this.dogProfile = backupData.data.dogProfile || {};
                this.savedNotes = backupData.data.savedNotes || [];
                this.foodHistory = backupData.data.foodHistory || [];
                this.isFirstTime = backupData.data.isFirstTime !== false;

                // Ricrea marker sulla mappa (solo cacche con GPS)
                this.poops.forEach(poop => {
                    if (!poop.isManual) {
                        this.addPoopMarker(poop);
                    }
                });

                // Salva tutto
                this.saveData();

                // Aggiorna UI
                this.updatePoopCounter();
                this.updateStats();
                this.updateDogName();
                this.updateFoodSuggestions();
                this.updateFoodFilter();
                this.updateSavedNotesList();
                this.closeSettingsModal();

                this.showToast(`✅ Backup importato! ${poopsCount} cacche ripristinate`);

                // Ricarica dopo 2 secondi per applicare tutte le modifiche
                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (error) {
                console.error('Errore importazione backup:', error);
                this.showToast('❌ Errore: file backup corrotto!');
            }
        };

        reader.onerror = () => {
            this.showToast('❌ Errore lettura file!');
        };

        reader.readAsText(file);
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
        console.log('setupEventListeners() chiamato - registrazione event listeners...');

        // Bottone aggiungi cacca
        document.getElementById('addPoopBtn').addEventListener('click', () => {
            this.addPoop();
        });

        // Bottone aggiungi cacca manuale
        document.getElementById('addManualPoopBtn').addEventListener('click', () => {
            this.addManualPoop();
        });

        // Bottone centra mappa
        document.getElementById('centerMapBtn').addEventListener('click', () => {
            this.centerOnUser();
        });

        // Bottone filtri
        document.getElementById('filterBtn').addEventListener('click', () => {
            this.openFiltersModal();
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

        // Bottone impostazioni
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        // Chiudi impostazioni
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // Toggle GPS
        document.getElementById('gpsToggle').addEventListener('change', () => {
            this.toggleGPS();
        });

        // Richiedi permessi GPS
        document.getElementById('requestGPSBtn').addEventListener('click', () => {
            this.requestGPSPermission();
        });

        // Cancella tutti i dati
        document.getElementById('clearAllDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });

        // Esporta backup
        document.getElementById('exportBackupBtn').addEventListener('click', () => {
            this.exportBackup();
        });

        // Importa backup
        document.getElementById('importBackupBtn').addEventListener('click', () => {
            this.importBackup();
        });

        // File input per importazione backup
        document.getElementById('importBackupInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.processBackupFile(file);
                // Reset input per permettere di selezionare lo stesso file di nuovo
                e.target.value = '';
            }
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

            // Se è inserimento manuale, usa data/ora personalizzata
            if (this.pendingPoopData && this.pendingPoopData.isManual) {
                const dateValue = document.getElementById('poopDate').value;
                const timeValue = document.getElementById('poopTime').value;

                if (!dateValue || !timeValue) {
                    this.showToast('⚠️ Inserisci data e ora!');
                    return;
                }

                // Crea timestamp da data e ora
                const customDateTime = new Date(`${dateValue}T${timeValue}`);

                // Valida che non sia nel futuro
                const now = new Date();
                if (customDateTime > now) {
                    this.showToast('⚠️ La data/ora non può essere nel futuro!');
                    return;
                }

                // Aggiorna timestamp in pendingPoopData
                this.pendingPoopData.timestamp = customDateTime.toISOString();
            } else {
                // Inserimento GPS - usa timestamp corrente se non già impostato
                if (!this.pendingPoopData.timestamp) {
                    this.pendingPoopData.timestamp = new Date().toISOString();
                }
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
            console.log('Form dogProfileForm submit evento ricevuto');
            e.preventDefault();
            console.log('preventDefault() chiamato, invocazione saveDogProfile()...');
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

        console.log('setupEventListeners() completato - tutti gli event listeners registrati con successo');
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
        try {
            console.log('saveData() chiamato');

            const data = {
                poops: this.poops,
                dogPhoto: this.dogPhoto,
                dogProfile: this.dogProfile,
                savedNotes: this.savedNotes,
                foodHistory: this.foodHistory,
                isFirstTime: false
            };

            // Verifica disponibilità localStorage
            if (typeof localStorage === 'undefined') {
                console.error('localStorage non disponibile');
                this.showToast('❌ Archiviazione dati non disponibile in questo browser');
                return false;
            }

            // Test scrittura localStorage
            try {
                localStorage.setItem('poopTrackerData', JSON.stringify(data));
                console.log('Dati salvati in localStorage con successo');
                return true;
            } catch (storageError) {
                console.error('Errore scrittura localStorage:', storageError);

                // Errori comuni
                if (storageError.name === 'QuotaExceededError') {
                    this.showToast('❌ Spazio archiviazione esaurito. Cancella alcuni dati.');
                } else if (storageError.name === 'SecurityError') {
                    this.showToast('❌ Archiviazione bloccata. Controlla impostazioni privacy browser.');
                } else {
                    this.showToast(`❌ Errore salvataggio: ${storageError.message}`);
                }
                return false;
            }
        } catch (error) {
            console.error('ERRORE in saveData():', error);
            console.error('Stack trace:', error.stack);
            this.showToast(`❌ Errore critico salvataggio: ${error.message}`);
            return false;
        }
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

                // Ricrea i marker per le cacche salvate (solo quelle con GPS)
                this.poops.forEach(poop => {
                    if (!poop.isManual) {
                        this.addPoopMarker(poop);
                    }
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
