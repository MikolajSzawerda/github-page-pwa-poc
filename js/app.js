console.log('I am running!');

class GeolocationLineWalker {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.linePoints = [];
        this.lineMarkers = [];
        this.walkingLine = null;
        this.progressLine = null;
        this.currentPosition = null;
        this.initialHeading = null;
        this.currentHeading = null;
        this.watchId = null;
        this.isInitialized = false;
        this.accuracyCircle = null;
        this.headingArrow = null;
        
        // Simplified location settings - much more user-friendly
        this.requiredAccuracy = 50; // More reasonable 50m instead of 10m
        this.maxLocationWait = 8000; // Only wait 8 seconds max
        this.lastKnownPosition = this.loadCachedPosition();
        this.locationSmoothing = [];
        this.maxSmoothingPoints = 3;
        
        this.isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.hostname === '';
        
        this.statusElement = document.getElementById('status');
        this.locationElement = document.getElementById('current-location');
        this.headingElement = document.getElementById('current-heading');
        this.progressElement = document.getElementById('progress');
        this.distanceElement = document.getElementById('distance-to-line');
        
        this.init();
    }
    
    init() {
        this.initMap();
        this.setupEventListeners();
        this.requestLocation();
    }
    
    loadCachedPosition() {
        try {
            const cached = localStorage.getItem('lastPosition');
            if (cached) {
                const pos = JSON.parse(cached);
                // Only use if less than 10 minutes old
                if (Date.now() - pos.timestamp < 600000) {
                    return pos;
                }
            }
        } catch (e) {
            console.warn('Could not load cached position');
        }
        return null;
    }
    
    cachePosition(position) {
        try {
            const toCache = {
                coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                },
                timestamp: Date.now()
            };
            localStorage.setItem('lastPosition', JSON.stringify(toCache));
        } catch (e) {
            console.warn('Could not cache position');
        }
    }
    
    initMap() {
        // Start with cached position if available
        const defaultLat = this.lastKnownPosition ? this.lastKnownPosition.coords.latitude : 37.7749;
        const defaultLng = this.lastKnownPosition ? this.lastKnownPosition.coords.longitude : -122.4194;
        
        this.map = L.map('map').setView([defaultLat, defaultLng], 18);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        if (this.lastKnownPosition) {
            this.updateStatus('Using cached location. Getting fresh GPS...');
        } else {
            this.updateStatus('Getting your location...');
        }
    }
    
    setupEventListeners() {
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetLine();
        });
        
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.centerMapOnUser();
        });
        
        if (this.isLocal) {
            const demoButton = document.createElement('button');
            demoButton.textContent = 'Demo Mode';
            demoButton.id = 'demo-btn';
            demoButton.addEventListener('click', () => {
                this.startDemoMode();
            });
            document.querySelector('.controls').appendChild(demoButton);
        }
    }
    
    requestLocation() {
        if (!navigator.geolocation) {
            this.updateStatus('❌ Geolocation not supported');
            if (this.isLocal) {
                this.updateStatus('💡 Try demo mode');
            }
            return;
        }
        
        // If we have cached position, use it immediately and improve in background
        if (this.lastKnownPosition) {
            this.handleInitialPosition(this.lastKnownPosition);
            this.updateStatus('📍 Using cached location. Improving accuracy...');
        }
        
        // Much more reasonable location settings
        const options = {
            enableHighAccuracy: true,
            timeout: this.maxLocationWait,
            maximumAge: 30000 // Allow 30-second old location
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.cachePosition(position);
                this.handleLocationResult(position);
            },
            (error) => {
                if (this.lastKnownPosition) {
                    // If we have cached position and current request fails, continue with cached
                    this.updateStatus('Using cached location (GPS unavailable)');
                } else {
                    this.handleLocationError(error);
                }
            },
            options
        );
    }
    
    handleLocationResult(position) {
        const accuracy = position.coords.accuracy;
        
        // Much more lenient - accept any reasonable accuracy
        if (accuracy <= this.requiredAccuracy || accuracy <= 100) {
            this.updateStatus(`✅ Location ready! (±${accuracy.toFixed(0)}m)`);
            this.handleInitialPosition(position);
        } else {
            // Even with poor accuracy, still proceed but warn user
            this.updateStatus(`⚠️ Poor GPS signal (±${accuracy.toFixed(0)}m) - trying anyway`);
            this.handleInitialPosition(position);
        }
    }
    
    startDemoMode() {
        const demoPosition = {
            coords: {
                latitude: 37.7749,
                longitude: -122.4194,
                accuracy: 5,
                heading: 45
            },
            timestamp: Date.now()
        };
        
        this.updateStatus('🎮 Demo mode');
        this.currentHeading = 45;
        this.updateHeadingDisplay(45);
        this.handleInitialPosition(demoPosition);
    }
    
    handleInitialPosition(position) {
        this.currentPosition = position;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        this.updateLocationDisplay(lat, lng, accuracy);
        this.map.setView([lat, lng], 18);
        
        // Update heading if available
        if (position.coords.heading !== null && position.coords.heading !== undefined) {
            this.currentHeading = position.coords.heading;
            this.updateHeadingDisplay(this.currentHeading);
        }
        
        // Create or update user marker (fix multiple markers bug)
        this.createUserMarker(lat, lng);
        
        // Create accuracy circle
        this.createAccuracyCircle(lat, lng, accuracy);
        
        // Start orientation detection
        this.requestDeviceOrientation();
    }
    
    createUserMarker(lat, lng) {
        // Remove existing marker to prevent duplicates
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }
        
        this.userMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background: #e74c3c; border: 3px solid white; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(this.map);
    }
    
    createAccuracyCircle(lat, lng, accuracy) {
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }
        
        this.accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3498db',
            fillColor: '#3498db',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(this.map);
    }
    
    requestDeviceOrientation() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        this.setupOrientationListener();
                    } else {
                        this.createLineWithDefaultHeading();
                    }
                })
                .catch(() => this.createLineWithDefaultHeading());
        } else if (window.DeviceOrientationEvent) {
            this.setupOrientationListener();
        } else {
            this.createLineWithDefaultHeading();
        }
    }
    
    setupOrientationListener() {
        let orientationTimeout = setTimeout(() => {
            this.createLineWithDefaultHeading();
        }, 3000); // Shorter timeout
        
        const handleOrientation = (event) => {
            if (this.initialHeading === null && event.alpha !== null) {
                clearTimeout(orientationTimeout);
                this.initialHeading = (360 - event.alpha) % 360;
                this.currentHeading = this.initialHeading;
                this.updateHeadingDisplay(this.currentHeading);
                this.createWalkingLine();
                window.removeEventListener('deviceorientationabsolute', handleOrientation);
                window.removeEventListener('deviceorientation', handleOrientation);
            }
        };
        
        // Lighter continuous updates
        const handleOrientationUpdate = (event) => {
            if (event.alpha !== null && this.isInitialized) {
                this.currentHeading = (360 - event.alpha) % 360;
                this.updateHeadingDisplay(this.currentHeading);
                this.updateHeadingArrow();
            }
        };
        
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);
        
        // Delayed continuous updates
        setTimeout(() => {
            window.addEventListener('deviceorientationabsolute', handleOrientationUpdate);
            window.addEventListener('deviceorientation', handleOrientationUpdate);
        }, 4000);
        
        this.updateStatus('🧭 Point device where you want to walk...');
    }
    
    createLineWithDefaultHeading() {
        this.initialHeading = 0;
        this.currentHeading = 0;
        this.updateHeadingDisplay(0);
        this.createWalkingLine();
    }
    
    createWalkingLine() {
        if (!this.currentPosition) return;
        
        const startLat = this.currentPosition.coords.latitude;
        const startLng = this.currentPosition.coords.longitude;
        const heading = this.initialHeading || 0;
        
        this.linePoints = [];
        for (let i = 0; i < 5; i++) {
            const point = this.calculateDestination(startLat, startLng, heading, i * 10);
            this.linePoints.push(point);
        }
        
        this.drawWalkingLine();
        this.drawLineMarkers();
        this.addHeadingArrow();
        
        this.isInitialized = true;
        document.getElementById('reset-btn').disabled = false;
        
        // Start position tracking with reduced frequency
        this.startPositionWatch();
        
        this.updateStatus('✅ Ready to walk! (40m total)');
    }
    
    calculateDestination(lat, lng, bearing, distance) {
        const R = 6371000;
        const δ = distance / R;
        const φ1 = lat * Math.PI / 180;
        const λ1 = lng * Math.PI / 180;
        const θ = bearing * Math.PI / 180;
        
        const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
        const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
        
        return {
            lat: φ2 * 180 / Math.PI,
            lng: λ2 * 180 / Math.PI
        };
    }
    
    drawWalkingLine() {
        const latLngs = this.linePoints.map(point => [point.lat, point.lng]);
        
        this.walkingLine = L.polyline(latLngs, {
            color: '#95a5a6',
            weight: 6,
            opacity: 0.7
        }).addTo(this.map);
        
        this.progressLine = L.polyline([], {
            color: '#27ae60',
            weight: 8,
            opacity: 0.9
        }).addTo(this.map);
    }
    
    drawLineMarkers() {
        this.lineMarkers = [];
        this.linePoints.forEach((point, index) => {
            const marker = L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                    className: 'line-marker',
                    html: `<div style="background: #3498db; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">${index + 1}</div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(this.map);
            
            marker.bindPopup(`Point ${index + 1}<br/>Distance: ${index * 10} meters`);
            this.lineMarkers.push(marker);
        });
    }
    
    addHeadingArrow() {
        if (!this.currentPosition) return;
        
        const lat = this.currentPosition.coords.latitude;
        const lng = this.currentPosition.coords.longitude;
        const heading = this.currentHeading || 0;
        
        const arrowEnd = this.calculateDestination(lat, lng, heading, 5);
        
        if (this.headingArrow) {
            this.map.removeLayer(this.headingArrow);
        }
        
        this.headingArrow = L.polyline([
            [lat, lng],
            [arrowEnd.lat, arrowEnd.lng]
        ], {
            color: '#e74c3c',
            weight: 4,
            opacity: 0.8
        }).addTo(this.map);
    }
    
    updateHeadingArrow() {
        if (!this.headingArrow || !this.currentPosition || !this.isInitialized) return;
        
        const lat = this.currentPosition.coords.latitude;
        const lng = this.currentPosition.coords.longitude;
        const heading = this.currentHeading || 0;
        
        const arrowEnd = this.calculateDestination(lat, lng, heading, 5);
        this.headingArrow.setLatLngs([
            [lat, lng],
            [arrowEnd.lat, arrowEnd.lng]
        ]);
    }
    
    startPositionWatch() {
        // Less aggressive tracking to reduce lag
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 2000 // Allow 2-second old positions
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updatePosition(position),
            (error) => {
                // Don't spam errors - just continue with last position
                console.warn('Position update failed:', error.message);
            },
            options
        );
    }
    
    smoothPosition(newPosition) {
        this.locationSmoothing.push(newPosition);
        if (this.locationSmoothing.length > this.maxSmoothingPoints) {
            this.locationSmoothing.shift();
        }
        
        // Return averaged position to reduce jumping
        const avgLat = this.locationSmoothing.reduce((sum, pos) => sum + pos.coords.latitude, 0) / this.locationSmoothing.length;
        const avgLng = this.locationSmoothing.reduce((sum, pos) => sum + pos.coords.longitude, 0) / this.locationSmoothing.length;
        
        return {
            coords: {
                latitude: avgLat,
                longitude: avgLng,
                accuracy: newPosition.coords.accuracy
            },
            timestamp: newPosition.timestamp
        };
    }
    
    updatePosition(position) {
        // Smooth the position to reduce jumping
        const smoothedPosition = this.smoothPosition(position);
        this.currentPosition = smoothedPosition;
        
        const lat = smoothedPosition.coords.latitude;
        const lng = smoothedPosition.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        this.updateLocationDisplay(lat, lng, accuracy);
        
        // Update markers with reduced frequency
        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
        }
        
        if (this.accuracyCircle) {
            this.accuracyCircle.setLatLng([lat, lng]);
            this.accuracyCircle.setRadius(accuracy);
        }
        
        // Update progress less frequently
        if (this.isInitialized) {
            this.updateProgress(lat, lng);
        }
        
        // Cache the position
        this.cachePosition(position);
    }
    
    updateProgress(userLat, userLng) {
        const projection = this.projectPointOntoLine(userLat, userLng);
        
        if (projection) {
            const progressPoints = [];
            
            if (projection.progress <= 0) {
                progressPoints.push([this.linePoints[0].lat, this.linePoints[0].lng]);
            } else if (projection.progress >= 1) {
                this.linePoints.forEach(point => {
                    progressPoints.push([point.lat, point.lng]);
                });
            } else {
                progressPoints.push([this.linePoints[0].lat, this.linePoints[0].lng]);
                progressPoints.push([projection.lat, projection.lng]);
            }
            
            this.progressLine.setLatLngs(progressPoints);
            
            const progressPercent = Math.min(100, Math.max(0, projection.progress * 100));
            this.progressElement.textContent = `${progressPercent.toFixed(1)}%`;
            this.progressElement.className = progressPercent > 80 ? 'progress-complete' : progressPercent > 20 ? 'progress-partial' : 'progress-none';
            
            this.distanceElement.textContent = `${projection.distance.toFixed(1)}m`;
            
            if (progressPercent >= 100) {
                this.updateStatus('🎉 Completed the 40m line!');
            } else if (progressPercent >= 80) {
                this.updateStatus('🚶 Almost there!');
            } else if (progressPercent >= 50) {
                this.updateStatus('👍 Halfway there!');
            } else {
                this.updateStatus('🚶‍♀️ Walking...');
            }
        }
    }
    
    projectPointOntoLine(userLat, userLng) {
        if (this.linePoints.length < 2) return null;
        
        const start = this.linePoints[0];
        const end = this.linePoints[this.linePoints.length - 1];
        
        const startPoint = { x: 0, y: 0 };
        const endPoint = {
            x: this.haversineDistance(start.lat, start.lng, start.lat, end.lng) * 
               (end.lng > start.lng ? 1 : -1),
            y: this.haversineDistance(start.lat, start.lng, end.lat, start.lng) * 
               (end.lat > start.lat ? 1 : -1)
        };
        const userPoint = {
            x: this.haversineDistance(start.lat, start.lng, start.lat, userLng) * 
               (userLng > start.lng ? 1 : -1),
            y: this.haversineDistance(start.lat, start.lng, userLat, start.lng) * 
               (userLat > start.lat ? 1 : -1)
        };
        
        const lineVector = { x: endPoint.x - startPoint.x, y: endPoint.y - startPoint.y };
        const userVector = { x: userPoint.x - startPoint.x, y: userPoint.y - startPoint.y };
        
        const lineLength = Math.sqrt(lineVector.x * lineVector.x + lineVector.y * lineVector.y);
        const projectionLength = (userVector.x * lineVector.x + userVector.y * lineVector.y) / lineLength;
        const progress = Math.max(0, Math.min(1, projectionLength / lineLength));
        
        const projectedPoint = {
            x: startPoint.x + progress * lineVector.x,
            y: startPoint.y + progress * lineVector.y
        };
        
        const projectedLat = start.lat + (projectedPoint.y / 111320);
        const projectedLng = start.lng + (projectedPoint.x / (111320 * Math.cos(start.lat * Math.PI / 180)));
        
        const distanceToLine = this.haversineDistance(userLat, userLng, projectedLat, projectedLng);
        
        return {
            lat: projectedLat,
            lng: projectedLng,
            progress: progress,
            distance: distanceToLine
        };
    }
    
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    updateLocationDisplay(lat, lng, accuracy) {
        this.locationElement.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${accuracy?.toFixed(0) || '?'}m)`;
    }
    
    updateHeadingDisplay(heading) {
        if (heading !== null && heading !== undefined) {
            const roundedHeading = Math.round(heading);
            let direction = '';
            
            if (heading >= 337.5 || heading < 22.5) direction = 'N';
            else if (heading >= 22.5 && heading < 67.5) direction = 'NE';
            else if (heading >= 67.5 && heading < 112.5) direction = 'E';
            else if (heading >= 112.5 && heading < 157.5) direction = 'SE';
            else if (heading >= 157.5 && heading < 202.5) direction = 'S';
            else if (heading >= 202.5 && heading < 247.5) direction = 'SW';
            else if (heading >= 247.5 && heading < 292.5) direction = 'W';
            else if (heading >= 292.5 && heading < 337.5) direction = 'NW';
            
            this.headingElement.textContent = `${roundedHeading}° ${direction}`;
        } else {
            this.headingElement.textContent = '--°';
        }
    }
    
    updateStatus(message) {
        this.statusElement.textContent = message;
    }
    
    handleLocationError(error) {
        let message = '❌ Location error: ';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'Access denied. Please enable location.';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'GPS unavailable.';
                if (this.isLocal) {
                    message += ' Try demo mode.';
                }
                break;
            case error.TIMEOUT:
                message += 'GPS timeout. Try again.';
                break;
            default:
                message += 'Unknown error.';
                break;
        }
        
        this.updateStatus(message);
    }
    
    centerMapOnUser() {
        if (this.currentPosition && this.userMarker) {
            const lat = this.currentPosition.coords.latitude;
            const lng = this.currentPosition.coords.longitude;
            this.map.setView([lat, lng], 18);
        }
    }
    
    resetLine() {
        // Clean up existing elements
        if (this.walkingLine) {
            this.map.removeLayer(this.walkingLine);
            this.walkingLine = null;
        }
        if (this.progressLine) {
            this.map.removeLayer(this.progressLine);
            this.progressLine = null;
        }
        if (this.headingArrow) {
            this.map.removeLayer(this.headingArrow);
            this.headingArrow = null;
        }
        this.lineMarkers.forEach(marker => this.map.removeLayer(marker));
        this.lineMarkers = [];
        this.linePoints = [];
        this.initialHeading = null;
        this.isInitialized = false;
        
        // Stop watching position
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Reset UI
        this.progressElement.textContent = '0%';
        this.progressElement.className = 'progress-none';
        this.distanceElement.textContent = '--';
        this.headingElement.textContent = '--°';
        document.getElementById('reset-btn').disabled = true;
        
        // Quick restart with current position if available
        if (this.currentPosition) {
            this.requestDeviceOrientation();
        } else {
            this.requestLocation();
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GeolocationLineWalker();
});