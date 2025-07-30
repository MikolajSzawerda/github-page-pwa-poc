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
        this.locationAttempts = 0;
        this.maxLocationAttempts = 5;
        this.requiredAccuracy = 10; // Require accuracy within 10 meters
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
        
        // Add debugging info for local development
        if (this.isLocal) {
            console.log('🔧 Running in local development mode');
            console.log('📍 Location:', window.location.href);
            console.log('🌐 Geolocation available:', !!navigator.geolocation);
            console.log('🔒 HTTPS:', window.location.protocol === 'https:');
        }
        
        this.requestLocation();
    }
    
    initMap() {
        // Default to a nice location (San Francisco) for demo
        const defaultLat = 37.7749;
        const defaultLng = -122.4194;
        
        this.map = L.map('map').setView([defaultLat, defaultLng], 18);
        
        // Add tile layer (using OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        this.updateStatus('Map initialized. Requesting high-accuracy location...');
    }
    
    setupEventListeners() {
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetLine();
        });
        
        document.getElementById('locate-btn').addEventListener('click', () => {
            this.centerMapOnUser();
        });
        
        // Add demo mode button for local development
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
            this.updateStatus('❌ Geolocation not supported by this browser');
            if (this.isLocal) {
                this.updateStatus('💡 Try demo mode or use a modern browser');
            }
            return;
        }
        
        this.locationAttempts++;
        this.updateStatus(`📍 Getting high-accuracy location... (Attempt ${this.locationAttempts}/${this.maxLocationAttempts})`);
        
        // Ultra high accuracy settings
        const options = {
            enableHighAccuracy: true,
            timeout: 30000, // 30 seconds timeout
            maximumAge: 0 // Always get fresh location
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => this.handleLocationResult(position),
            (error) => this.handleLocationError(error),
            options
        );
    }
    
    handleLocationResult(position) {
        const accuracy = position.coords.accuracy;
        
        console.log(`📍 Location received:`, {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: accuracy,
            timestamp: new Date(position.timestamp)
        });
        
        // Check if accuracy is good enough
        if (accuracy > this.requiredAccuracy && this.locationAttempts < this.maxLocationAttempts && !this.isLocal) {
            this.updateStatus(`⚠️ Accuracy: ${accuracy.toFixed(1)}m (need ≤${this.requiredAccuracy}m). Retrying...`);
            
            // Wait a bit and try again
            setTimeout(() => {
                this.requestLocation();
            }, 2000);
            return;
        }
        
        // Accept the position
        this.updateStatus(`✅ Location acquired! Accuracy: ${accuracy.toFixed(1)}m`);
        this.handleInitialPosition(position);
    }
    
    startDemoMode() {
        // Create a demo position in San Francisco
        const demoPosition = {
            coords: {
                latitude: 37.7749,
                longitude: -122.4194,
                accuracy: 5,
                heading: 45 // Demo heading (NE direction)
            },
            timestamp: Date.now()
        };
        
        this.updateStatus('🎮 Demo mode activated!');
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
        this.map.setView([lat, lng], 19); // High zoom for accuracy
        
        // Update heading if available from position
        if (position.coords.heading !== null && position.coords.heading !== undefined) {
            this.currentHeading = position.coords.heading;
            this.updateHeadingDisplay(this.currentHeading);
        }
        
        // Add user marker
        this.userMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background: #e74c3c; border: 3px solid white; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(this.map);
        
        // Add accuracy circle
        this.accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#3498db',
            fillColor: '#3498db',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(this.map);
        
        // Request device orientation for heading
        this.requestDeviceOrientation();
    }
    
    requestDeviceOrientation() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ permission request
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
            // Android and older iOS
            this.setupOrientationListener();
        } else {
            this.createLineWithDefaultHeading();
        }
    }
    
    setupOrientationListener() {
        let orientationTimeout = setTimeout(() => {
            this.createLineWithDefaultHeading();
        }, 5000); // Longer timeout for better heading detection
        
        const handleOrientation = (event) => {
            if (this.initialHeading === null && event.alpha !== null) {
                clearTimeout(orientationTimeout);
                // FIX: Invert the heading to fix opposite direction bug
                // Device orientation alpha goes clockwise, but compass bearing goes counter-clockwise
                this.initialHeading = (360 - event.alpha) % 360;
                this.currentHeading = this.initialHeading;
                console.log(`🧭 Initial heading: device=${event.alpha}°, corrected=${this.initialHeading}°`);
                this.updateHeadingDisplay(this.currentHeading);
                this.createWalkingLine();
                window.removeEventListener('deviceorientationabsolute', handleOrientation);
                window.removeEventListener('deviceorientation', handleOrientation);
            }
        };
        
        // Continue listening for heading updates
        const handleOrientationUpdate = (event) => {
            if (event.alpha !== null) {
                // FIX: Apply same correction to continuous updates
                this.currentHeading = (360 - event.alpha) % 360;
                this.updateHeadingDisplay(this.currentHeading);
                this.updateHeadingArrow();
            }
        };
        
        // Try absolute orientation first (more accurate)
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);
        
        // Set up continuous heading updates after initial line creation
        setTimeout(() => {
            window.addEventListener('deviceorientationabsolute', handleOrientationUpdate);
            window.addEventListener('deviceorientation', handleOrientationUpdate);
        }, 6000);
        
        this.updateStatus('🧭 Point your device in the direction you want to walk...');
    }
    
    createLineWithDefaultHeading() {
        this.initialHeading = 0; // Default to North
        this.currentHeading = 0;
        this.updateHeadingDisplay(0);
        this.createWalkingLine();
    }
    
    createWalkingLine() {
        if (!this.currentPosition) return;
        
        const startLat = this.currentPosition.coords.latitude;
        const startLng = this.currentPosition.coords.longitude;
        const heading = this.initialHeading || 0;
        
        console.log(`🎯 Creating line: lat=${startLat}, lng=${startLng}, heading=${heading}°`);
        
        // Create 5 points, each 10 meters apart
        this.linePoints = [];
        for (let i = 0; i < 5; i++) {
            const point = this.calculateDestination(startLat, startLng, heading, i * 10);
            this.linePoints.push(point);
            console.log(`📍 Point ${i}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} (${i * 10}m)`);
        }
        
        // Draw the walking line
        this.drawWalkingLine();
        this.drawLineMarkers();
        this.addHeadingArrow();
        
        this.isInitialized = true;
        document.getElementById('reset-btn').disabled = false;
        
        // Start watching position with high accuracy
        this.startPositionWatch();
        
        this.updateStatus('✅ Line created! Start walking towards the points (40m total).');
    }
    
    calculateDestination(lat, lng, bearing, distance) {
        const R = 6371000; // Earth's radius in meters
        const δ = distance / R; // angular distance
        const φ1 = lat * Math.PI / 180; // latitude in radians
        const λ1 = lng * Math.PI / 180; // longitude in radians
        const θ = bearing * Math.PI / 180; // bearing in radians
        
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
        
        // Create arrow pointing in the direction of the line
        const arrowEnd = this.calculateDestination(lat, lng, heading, 5); // 5 meter arrow
        
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
        if (!this.headingArrow || !this.currentPosition) return;
        
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
        // Ultra high accuracy tracking
        const options = {
            enableHighAccuracy: true,
            timeout: 15000, // 15 seconds
            maximumAge: 500 // Max 0.5 seconds old
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updatePosition(position),
            (error) => {
                console.warn('Position watch error:', error);
                // Show error but don't stop the app
                this.updateStatus(`⚠️ Location tracking error: ${error.message}`);
            },
            options
        );
    }
    
    updatePosition(position) {
        this.currentPosition = position;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        console.log(`📍 Position update:`, {
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            timestamp: new Date(position.timestamp)
        });
        
        this.updateLocationDisplay(lat, lng, accuracy);
        
        // Update heading if available from position
        if (position.coords.heading !== null && position.coords.heading !== undefined) {
            this.currentHeading = position.coords.heading;
            this.updateHeadingDisplay(this.currentHeading);
            this.updateHeadingArrow();
        }
        
        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
        }
        
        // Update accuracy circle
        if (this.accuracyCircle) {
            this.accuracyCircle.setLatLng([lat, lng]);
            this.accuracyCircle.setRadius(accuracy);
        }
        
        if (this.isInitialized) {
            this.updateProgress(lat, lng);
        }
    }
    
    updateProgress(userLat, userLng) {
        // FIX: Simplified and corrected projection calculation
        const projection = this.projectPointOntoLine(userLat, userLng);
        
        if (projection) {
            console.log(`🎯 Projection:`, {
                userPos: [userLat, userLng],
                projectedPos: [projection.lat, projection.lng],
                progress: projection.progress,
                distance: projection.distance
            });
            
            // Update progress line - FIX: Use actual line points for proper visualization
            const progressPoints = [];
            
            if (projection.progress <= 0) {
                // No progress yet
                progressPoints.push([this.linePoints[0].lat, this.linePoints[0].lng]);
            } else if (projection.progress >= 1) {
                // Complete line
                this.linePoints.forEach(point => {
                    progressPoints.push([point.lat, point.lng]);
                });
            } else {
                // Partial progress
                progressPoints.push([this.linePoints[0].lat, this.linePoints[0].lng]);
                progressPoints.push([projection.lat, projection.lng]);
            }
            
            this.progressLine.setLatLngs(progressPoints);
            
            // Update progress display
            const progressPercent = Math.min(100, Math.max(0, projection.progress * 100));
            this.progressElement.textContent = `${progressPercent.toFixed(1)}%`;
            this.progressElement.className = progressPercent > 80 ? 'progress-complete' : progressPercent > 20 ? 'progress-partial' : 'progress-none';
            
            // Update distance to line
            this.distanceElement.textContent = `${projection.distance.toFixed(1)}m`;
            
            // Update status based on progress
            if (progressPercent >= 100) {
                this.updateStatus('🎉 Congratulations! You completed the 40m line!');
            } else if (progressPercent >= 80) {
                this.updateStatus('🚶 Almost there! Keep going!');
            } else if (progressPercent >= 50) {
                this.updateStatus('👍 Great progress! You\'re halfway there!');
            } else {
                this.updateStatus('🚶‍♀️ Walking the line...');
            }
        }
    }
    
    projectPointOntoLine(userLat, userLng) {
        if (this.linePoints.length < 2) return null;
        
        const start = this.linePoints[0];
        const end = this.linePoints[this.linePoints.length - 1];
        
        // FIX: Simplified projection using proper vector mathematics
        // Convert coordinates to a local meter-based system
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
        
        // Project user point onto the line vector
        const lineVector = { x: endPoint.x - startPoint.x, y: endPoint.y - startPoint.y };
        const userVector = { x: userPoint.x - startPoint.x, y: userPoint.y - startPoint.y };
        
        const lineLength = Math.sqrt(lineVector.x * lineVector.x + lineVector.y * lineVector.y);
        const projectionLength = (userVector.x * lineVector.x + userVector.y * lineVector.y) / lineLength;
        const progress = Math.max(0, Math.min(1, projectionLength / lineLength));
        
        // Calculate projected point coordinates
        const projectedPoint = {
            x: startPoint.x + progress * lineVector.x,
            y: startPoint.y + progress * lineVector.y
        };
        
        // Convert back to lat/lng
        const projectedLat = start.lat + (projectedPoint.y / 111320);
        const projectedLng = start.lng + (projectedPoint.x / (111320 * Math.cos(start.lat * Math.PI / 180)));
        
        // Calculate distance from user to projected point
        const distanceToLine = this.haversineDistance(userLat, userLng, projectedLat, projectedLng);
        
        return {
            lat: projectedLat,
            lng: projectedLng,
            progress: progress,
            distance: distanceToLine
        };
    }
    
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    updateLocationDisplay(lat, lng, accuracy) {
        this.locationElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)} (±${accuracy?.toFixed(1) || '?'}m)`;
    }
    
    updateHeadingDisplay(heading) {
        if (heading !== null && heading !== undefined) {
            const roundedHeading = Math.round(heading);
            let direction = '';
            
            // Convert heading to compass direction
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
        console.log('Status:', message);
    }
    
    handleLocationError(error) {
        let message = '❌ Location error: ';
        let suggestions = '';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'Location access denied.';
                suggestions = '💡 Please enable location services and allow location access.';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'Location information unavailable.';
                if (this.isLocal) {
                    suggestions = '💡 Try using HTTPS or enable location services. Use Demo Mode to test.';
                } else {
                    suggestions = '💡 Please check your GPS signal and try again.';
                }
                break;
            case error.TIMEOUT:
                message += 'Location request timed out.';
                suggestions = '💡 Please try again or check your connection.';
                break;
            default:
                message += 'Unknown error occurred.';
                break;
        }
        
        // Retry if we haven't reached max attempts
        if (this.locationAttempts < this.maxLocationAttempts && !this.isLocal) {
            setTimeout(() => {
                this.requestLocation();
            }, 3000);
            message += ` Retrying... (${this.locationAttempts}/${this.maxLocationAttempts})`;
        }
        
        this.updateStatus(message + ' ' + suggestions);
        console.error('Geolocation error:', error);
    }
    
    centerMapOnUser() {
        if (this.currentPosition && this.userMarker) {
            const lat = this.currentPosition.coords.latitude;
            const lng = this.currentPosition.coords.longitude;
            this.map.setView([lat, lng], 19);
        }
    }
    
    resetLine() {
        // Clear existing line and markers
        if (this.walkingLine) {
            this.map.removeLayer(this.walkingLine);
            this.walkingLine = null;
        }
        if (this.progressLine) {
            this.map.removeLayer(this.progressLine);
            this.progressLine = null;
        }
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
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
        this.locationAttempts = 0;
        
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
        
        // Restart the process with fresh location request
        this.requestLocation();
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GeolocationLineWalker();
});