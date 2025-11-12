// Poo-Poo Dog Tracker App
class PoopTracker {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.userPosition = null;
        this.poops = [];
        this.poopMarkers = [];
        this.dogPhoto = null;
        this.watchId = null;

        this.init();
    }

    init() {
        // Inizializza la mappa
        this.initMap();

        // Carica dati salvati
        this.loadSavedData();

        // Inizializza geolocalizzazione
        this.initGeolocation();

        // Setup event listeners
        this.setupEventListeners();

        // Aggiorna il contatore
        this.updatePoopCounter();
    }

    initMap() {
        // Crea la mappa centrata su una posizione di default
        this.map = L.map('map', {
            zoomControl: true,
            attributionControl: false
        }).setView([45.4642, 9.1900], 13); // Milano come default

        // Aggiungi tile layer con stile cartoon-like
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(this.map);

        // Personalizza lo zoom control
        this.map.zoomControl.setPosition('topright');
    }

    initGeolocation() {
        if (!navigator.geolocation) {
            this.showToast('❌ Geolocalizzazione non supportata dal browser');
            return;
        }

        // Richiedi la posizione corrente
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

        // Tracking continuo della posizione
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

        // Rimuovi il marker precedente
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        // Crea icona personalizzata per l'utente
        const iconHtml = this.dogPhoto
            ? `<div class="dog-marker" style="background-image: url('${this.dogPhoto}'); background-size: cover; background-position: center;"></div>`
            : `<div class="dog-marker" style="display: flex; align-items: center; justify-content: center; font-size: 2em;">🐕</div>`;

        const userIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-user-marker',
            iconSize: [80, 80],
            iconAnchor: [40, 40]
        });

        // Aggiungi nuovo marker
        this.userMarker = L.marker([this.userPosition.lat, this.userPosition.lng], {
            icon: userIcon,
            zIndexOffset: 1000
        }).addTo(this.map);

        // Aggiungi evento click per cambiare la foto
        this.userMarker.on('click', () => {
            this.openDogPhotoModal();
        });

        // Aggiungi popup
        this.userMarker.bindPopup('<b>🐕 Tu e il tuo cane siete qui!</b><br>Clicca per cambiare la foto').openPopup();
    }

    addPoop() {
        if (!this.userPosition) {
            this.showToast('⚠️ Aspetta che la posizione venga rilevata!');
            return;
        }

        const poop = {
            id: Date.now(),
            lat: this.userPosition.lat,
            lng: this.userPosition.lng,
            timestamp: new Date().toISOString()
        };

        this.poops.push(poop);
        this.addPoopMarker(poop);
        this.saveData();
        this.updatePoopCounter();
        this.showToast('💩 Cacca aggiunta con successo!');
    }

    addPoopMarker(poop) {
        // Emoji casuali per variare le cacche
        const poopEmojis = ['💩', '💩', '💩', '🧻', '🌰'];
        const emoji = poopEmojis[Math.floor(Math.random() * poopEmojis.length)];

        const poopIcon = L.divIcon({
            html: `<div class="poop-marker">${emoji}</div>`,
            className: 'custom-poop-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const marker = L.marker([poop.lat, poop.lng], {
            icon: poopIcon
        }).addTo(this.map);

        // Aggiungi popup con informazioni
        const date = new Date(poop.timestamp);
        const dateStr = date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        marker.bindPopup(`
            <div style="text-align: center; font-family: 'Fredoka', cursive;">
                <b>💩 Cacca del cane!</b><br>
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
        // Rimuovi dalla lista
        this.poops = this.poops.filter(p => p.id !== poopId);

        // Rimuovi marker dalla mappa
        const poopMarker = this.poopMarkers.find(pm => pm.id === poopId);
        if (poopMarker) {
            this.map.removeLayer(poopMarker.marker);
            this.poopMarkers = this.poopMarkers.filter(pm => pm.id !== poopId);
        }

        this.saveData();
        this.updatePoopCounter();
        this.showToast('🗑️ Cacca rimossa!');
    }

    clearAllPoops() {
        if (this.poops.length === 0) {
            this.showToast('😊 Non ci sono cacche da rimuovere!');
            return;
        }

        if (confirm(`Sei sicuro di voler rimuovere tutte le ${this.poops.length} cacche? 💩`)) {
            // Rimuovi tutti i marker
            this.poopMarkers.forEach(pm => {
                this.map.removeLayer(pm.marker);
            });

            this.poops = [];
            this.poopMarkers = [];
            this.saveData();
            this.updatePoopCounter();
            this.showToast('✨ Tutte le cacche sono state rimosse!');
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

    openDogPhotoModal() {
        const modal = document.getElementById('dogPhotoModal');
        modal.classList.add('active');

        // Mostra foto corrente se esiste
        const preview = document.getElementById('dogPhotoPreview');
        if (this.dogPhoto) {
            preview.innerHTML = `<img src="${this.dogPhoto}" alt="Dog Photo">`;
        } else {
            preview.innerHTML = '<span class="placeholder-text">Clicca per aggiungere foto 🐕</span>';
        }
    }

    closeDogPhotoModal() {
        const modal = document.getElementById('dogPhotoModal');
        modal.classList.remove('active');
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

        // Bottone cancella tutto
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllPoops();
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
                // Se c'è già una foto salvata, chiudi semplicemente
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
        document.getElementById('dogPhotoModal').addEventListener('click', (e) => {
            if (e.target.id === 'dogPhotoModal') {
                this.closeDogPhotoModal();
            }
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
