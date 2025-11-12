// Poo-Poo Dog Tracker App - Enhanced Version
class PoopTracker {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.userPosition = null;
        this.poops = [];
        this.poopMarkers = [];
        this.dogPhoto = null;
        this.watchId = null;
        this.activeFilters = { period: 'all', type: 'all' };
        this.pendingPoopData = null;

        this.init();
    }

    init() {
        this.initMap();
        this.loadSavedData();
        this.initGeolocation();
        this.setupEventListeners();
        this.updatePoopCounter();
        this.updateStats();
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

        const popupText = this.dogPhoto
            ? '<b>🐕 Tu e il tuo cane siete qui!</b><br>Clicca per cambiare la foto'
            : '<b>🐕 Tu e il tuo cane siete qui!</b><br>Clicca per aggiungere la foto del tuo cane';
        this.userMarker.bindPopup(popupText);
    }

    // Anti-sovrapposizione: trova una posizione libera vicina
    findNearbyFreePosition(lat, lng) {
        const MIN_DISTANCE = 0.00003; // ~3 metri
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

        // Trova posizione libera
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
        this.addPoopMarker(poop);
        this.saveData();
        this.updatePoopCounter();
        this.updateStats();
        this.showToast('💩 Cacca registrata con successo!');

        this.pendingPoopData = null;
    }

    getPoopIcon(type) {
        // Sceglie l'icona SVG in base allo stato
        if (type === 'healthy') {
            return 'poop-happy';
        } else if (type === 'blood' || type === 'mucus') {
            return 'poop-sick';
        } else {
            return 'poop-sad';
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

        marker.bindPopup(`
            <div style="text-align: center; font-family: 'Fredoka', cursive;">
                <b>💩 Dettagli Cacca</b><br>
                <div style="margin: 10px 0; text-align: left;">
                    <b>Stato:</b> ${typeLabels[poop.type] || poop.type}<br>
                    <b>Dimensione:</b> ${poop.size}<br>
                    <b>Colore:</b> ${poop.color}<br>
                    <b>Odore:</b> ${poop.smell}<br>
                    ${poop.notes ? `<b>Note:</b> ${poop.notes}<br>` : ''}
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
        `);

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

        if (confirm(`Sei sicuro di voler rimuovere tutte le ${this.poops.length} cacche? 💩`)) {
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

    // Filtri
    applyFilters() {
        const period = document.getElementById('filterPeriod').value;
        const type = document.getElementById('filterType').value;

        this.activeFilters = { period, type };

        // Rimuovi tutti i marker
        this.poopMarkers.forEach(pm => {
            this.map.removeLayer(pm.marker);
        });
        this.poopMarkers = [];

        // Filtra e riaggi marker
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

        return filtered;
    }

    resetFilters() {
        this.activeFilters = { period: 'all', type: 'all' };
        document.getElementById('filterPeriod').value = 'all';
        document.getElementById('filterType').value = 'all';
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

            return `
                <div class="poop-list-item">
                    <div class="poop-item-info">
                        <div class="poop-item-date">${dateStr}</div>
                        <div class="poop-item-status">${typeLabels[poop.type]}</div>
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
        // Reset form
        document.getElementById('poopDetailsForm').reset();
    }

    closePoopDetailsModal() {
        document.getElementById('poopDetailsModal').classList.remove('active');
        this.pendingPoopData = null;
    }

    openFiltersModal() {
        document.getElementById('filtersModal').classList.add('active');
        this.updateStats();
        this.updateRecentPoopsList();
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

        // Form dettagli cacca
        document.getElementById('poopDetailsForm').addEventListener('submit', (e) => {
            e.preventDefault();

            const details = {
                type: document.getElementById('poopType').value,
                size: document.getElementById('poopSize').value,
                color: document.getElementById('poopColor').value,
                smell: document.getElementById('poopSmell').value,
                notes: document.getElementById('poopNotes').value.trim()
            };

            this.savePoopWithDetails(details);
            this.closePoopDetailsModal();
        });

        document.getElementById('cancelPoopDetails').addEventListener('click', () => {
            this.closePoopDetailsModal();
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
            dogPhoto: this.dogPhoto
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
