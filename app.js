// Weather Chaser Application - Enhanced Version
class WeatherChaser {
    constructor() {
        this.map = null;
        this.markers = [];
        this.weatherData = [];
        this.currentSortColumn = null;
        this.currentSortDirection = 'desc';
        this.searchMode = 'location'; // 'location' or 'draw'
        this.drawnItems = null;
        this.drawControl = null;
        this.drawnShape = null;

        this.init();
    }

    init() {
        this.initMap();
        this.attachEventListeners();
    }

    initMap() {
        // Initialize Leaflet map centered on Europe
        this.map = L.map('map').setView([50.0, 10.0], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Initialize Leaflet Draw
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);

        this.drawControl = new L.Control.Draw({
            draw: {
                polygon: true,
                rectangle: true,
                circle: false,
                marker: false,
                polyline: false,
                circlemarker: false
            },
            edit: {
                featureGroup: this.drawnItems,
                remove: true
            }
        });

        // Add draw control to map initially hidden
        this.map.addControl(this.drawControl);
        this.toggleDrawControl(false);

        // Handle drawn shapes
        this.map.on(L.Draw.Event.CREATED, (e) => {
            // Remove previous shape
            this.drawnItems.clearLayers();
            this.drawnShape = e.layer;
            this.drawnItems.addLayer(this.drawnShape);
        });

        this.map.on(L.Draw.Event.DELETED, () => {
            this.drawnShape = null;
        });
    }

    toggleDrawControl(show) {
        const drawContainer = document.querySelector('.leaflet-draw');
        if (drawContainer) {
            drawContainer.style.display = show ? 'block' : 'none';
        }
    }

    attachEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const locationInput = document.getElementById('location');

        searchBtn.addEventListener('click', () => this.handleSearch());
        locationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Table sorting
        document.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.column));
        });
    }

    switchMode(mode) {
        this.searchMode = mode;

        // Update tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update mode panels
        document.querySelectorAll('.search-mode').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(mode + 'Mode').classList.add('active');

        // Toggle draw controls
        this.toggleDrawControl(mode === 'draw');
    }

    async handleSearch() {
        const days = parseInt(document.getElementById('days').value);

        this.showLoading(true);

        try {
            let gridPoints;

            if (this.searchMode === 'location') {
                const location = document.getElementById('location').value.trim();
                const radius = parseInt(document.getElementById('radius').value);
                const gridSize = parseInt(document.getElementById('gridSize').value);

                if (!location) {
                    alert('Please enter a location');
                    return;
                }

                // Geocode location
                const coords = await this.geocodeLocation(location);

                // Generate grid points
                gridPoints = this.generateGridFromCenter(coords.lat, coords.lon, radius, gridSize);

                // Center map on location
                this.map.setView([coords.lat, coords.lon], 8);

            } else { // draw mode
                if (!this.drawnShape) {
                    alert('Please draw an area on the map first');
                    return;
                }

                const gridSize = parseInt(document.getElementById('drawGridSize').value);
                gridPoints = this.generateGridFromShape(this.drawnShape, gridSize);
            }

            // Fetch weather data for all grid points
            const weatherData = await this.fetchWeatherForGrid(gridPoints, days);

            // Calculate scores and sort
            this.weatherData = this.calculateScores(weatherData);

            // Display results
            this.displayResults();

        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async geocodeLocation(location) {
        // Check if it's coordinates (lat,lon)
        const coordPattern = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
        const coordMatch = location.match(coordPattern);

        if (coordMatch) {
            return {
                lat: parseFloat(coordMatch[1]),
                lon: parseFloat(coordMatch[2])
            };
        }

        // Use Nominatim for geocoding
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'WeatherChaser/1.0'
            }
        });

        if (!response.ok) {
            throw new Error('Geocoding failed');
        }

        const data = await response.json();

        if (data.length === 0) {
            throw new Error('Location not found');
        }

        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    }

    generateGridFromCenter(centerLat, centerLon, radiusKm, gridSize) {
        const points = [];
        const gridDim = Math.sqrt(gridSize);

        // Convert radius to degrees (rough approximation)
        const latDegrees = radiusKm / 111;
        const lonDegrees = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

        // Calculate step size
        const latStep = (2 * latDegrees) / (gridDim - 1);
        const lonStep = (2 * lonDegrees) / (gridDim - 1);

        // Generate grid points
        for (let i = 0; i < gridDim; i++) {
            for (let j = 0; j < gridDim; j++) {
                const lat = centerLat - latDegrees + (i * latStep);
                const lon = centerLon - lonDegrees + (j * lonStep);

                points.push({
                    lat: lat,
                    lon: lon,
                    index: points.length
                });
            }
        }

        return points;
    }

    generateGridFromShape(shape, gridSize) {
        const bounds = shape.getBounds();
        const points = [];
        const gridDim = Math.sqrt(gridSize);

        const latMin = bounds.getSouth();
        const latMax = bounds.getNorth();
        const lonMin = bounds.getWest();
        const lonMax = bounds.getEast();

        const latStep = (latMax - latMin) / (gridDim - 1);
        const lonStep = (lonMax - lonMin) / (gridDim - 1);

        for (let i = 0; i < gridDim; i++) {
            for (let j = 0; j < gridDim; j++) {
                const lat = latMin + (i * latStep);
                const lon = lonMin + (j * lonStep);

                // Check if point is inside polygon (for polygons)
                if (shape instanceof L.Polygon) {
                    const point = L.latLng(lat, lon);
                    if (!this.pointInPolygon(point, shape)) {
                        continue;
                    }
                }

                points.push({
                    lat: lat,
                    lon: lon,
                    index: points.length
                });
            }
        }

        return points;
    }

    pointInPolygon(point, polygon) {
        const latlngs = polygon.getLatLngs()[0];
        let inside = false;

        for (let i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
            const xi = latlngs[i].lat, yi = latlngs[i].lng;
            const xj = latlngs[j].lat, yj = latlngs[j].lng;

            const intersect = ((yi > point.lng) !== (yj > point.lng))
                && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    }

    async fetchWeatherForGrid(gridPoints, days) {
        const weatherPromises = gridPoints.map(point =>
            this.fetchWeatherForPoint(point, days)
        );

        return await Promise.all(weatherPromises);
    }

    async fetchWeatherForPoint(point, days) {
        // Open-Meteo API with enhanced weather data
        const url = `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${point.lat}&longitude=${point.lon}` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunshine_duration,windspeed_10m_max,relative_humidity_2m_mean` +
            `&timezone=auto&forecast_days=${days}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Weather API error for point ${point.index}`);
            }

            const data = await response.json();

            return {
                lat: point.lat,
                lon: point.lon,
                index: point.index,
                weather: data.daily
            };
        } catch (error) {
            console.error(`Error fetching weather for point ${point.index}:`, error);
            return {
                lat: point.lat,
                lon: point.lon,
                index: point.index,
                weather: null
            };
        }
    }

    calculateScores(weatherData) {
        const results = [];

        for (const point of weatherData) {
            if (!point.weather) continue;

            const weather = point.weather;
            const numDays = weather.time.length;

            // Calculate averages
            const avgTempMax = this.average(weather.temperature_2m_max);
            const avgTempMin = this.average(weather.temperature_2m_min);
            const avgTemp = (avgTempMax + avgTempMin) / 2;

            const totalRain = this.sum(weather.precipitation_sum);
            const avgRainPerDay = totalRain / numDays;
            const avgRainChance = this.average(weather.precipitation_probability_max);

            const totalSunHours = this.sum(weather.sunshine_duration) / 3600; // Convert seconds to hours
            const avgSunHours = totalSunHours / numDays;

            const avgWind = this.average(weather.windspeed_10m_max);
            const avgHumidity = this.average(weather.relative_humidity_2m_mean);

            // Calculate score with weights:
            // Rain amount: 25% (less rain is better)
            // Rain probability: 25% (less chance is better)
            // Sun: 30%
            // Temperature: 15% (normalized to 0-100, optimum around 20-25°C)
            // Wind: 5% (less wind is better)

            const rainAmountScore = Math.max(0, 100 - (avgRainPerDay * 10)); // 10mm = 0 score
            const rainChanceScore = Math.max(0, 100 - avgRainChance);
            const sunScore = Math.min(100, (avgSunHours / 12) * 100); // 12 hours = perfect
            const tempScore = this.calculateTempScore(avgTemp);
            const windScore = Math.max(0, 100 - (avgWind * 2)); // 50 km/h = 0 score

            const totalScore = (
                rainAmountScore * 0.25 +
                rainChanceScore * 0.25 +
                sunScore * 0.30 +
                tempScore * 0.15 +
                windScore * 0.05
            );

            results.push({
                lat: point.lat,
                lon: point.lon,
                score: Math.round(totalScore * 10) / 10,
                avgTemp: Math.round(avgTemp * 10) / 10,
                sunHours: Math.round(avgSunHours * 10) / 10,
                rainAmount: Math.round(totalRain * 10) / 10,
                rainChance: Math.round(avgRainChance),
                windSpeed: Math.round(avgWind * 10) / 10,
                humidity: Math.round(avgHumidity),
                rawData: weather
            });
        }

        // Sort by score (highest first)
        results.sort((a, b) => b.score - a.score);

        // Add rank
        results.forEach((item, index) => {
            item.rank = index + 1;
        });

        return results;
    }

    calculateTempScore(temp) {
        // Optimal temperature range: 20-25°C
        const optimal = 22.5;
        const diff = Math.abs(temp - optimal);

        if (diff <= 2.5) return 100;
        if (diff <= 5) return 90;
        if (diff <= 10) return 70;
        if (diff <= 15) return 50;
        if (diff <= 20) return 30;
        return 10;
    }

    average(arr) {
        const validValues = arr.filter(v => v !== null && v !== undefined);
        return validValues.length > 0
            ? validValues.reduce((a, b) => a + b, 0) / validValues.length
            : 0;
    }

    sum(arr) {
        const validValues = arr.filter(v => v !== null && v !== undefined);
        return validValues.reduce((a, b) => a + b, 0);
    }

    displayResults() {
        this.displayOnMap();
        this.displayInTable();

        // Show results section
        document.getElementById('resultsSection').classList.remove('hidden');

        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    displayOnMap() {
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        if (this.weatherData.length === 0) return;

        // Add markers for all points
        this.weatherData.forEach((point, index) => {
            const color = this.getColorForScore(point.score);

            const marker = L.circleMarker([point.lat, point.lon], {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(this.map);

            // Create popup
            const popupContent = `
                <div class="weather-popup">
                    <h3>Rank #${point.rank}</h3>
                    <p><strong>Score:</strong> ${point.score}</p>
                    <p><strong>Avg Temp:</strong> ${point.avgTemp}°C</p>
                    <p><strong>Sun Hours:</strong> ${point.sunHours}h/day</p>
                    <p><strong>Total Rain:</strong> ${point.rainAmount}mm</p>
                    <p><strong>Rain Chance:</strong> ${point.rainChance}%</p>
                    <p><strong>Wind:</strong> ${point.windSpeed} km/h</p>
                    <p><strong>Humidity:</strong> ${point.humidity}%</p>
                    <p><small>Lat: ${point.lat.toFixed(4)}, Lon: ${point.lon.toFixed(4)}</small></p>
                </div>
            `;

            marker.bindPopup(popupContent);

            marker.on('mouseover', function() {
                this.setStyle({ radius: 12, weight: 3 });
            });

            marker.on('mouseout', function() {
                this.setStyle({ radius: 8, weight: 2 });
            });

            this.markers.push(marker);
        });

        // Fit map to show all markers
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    displayInTable() {
        const tbody = document.getElementById('resultsBody');
        tbody.innerHTML = '';

        this.weatherData.forEach((point, index) => {
            // Main data row
            const row = document.createElement('tr');
            row.classList.add('data-row');
            row.dataset.index = index;

            row.innerHTML = `
                <td><span class="expand-icon">▶</span></td>
                <td>${point.rank}</td>
                <td><span class="score-badge ${this.getScoreClass(point.score)}">${point.score}</span></td>
                <td>${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}</td>
                <td>${point.avgTemp}°C</td>
                <td>${point.sunHours}h</td>
                <td>${point.rainAmount}mm</td>
                <td>${point.rainChance}%</td>
                <td>${point.windSpeed} km/h</td>
                <td>${point.humidity}%</td>
            `;

            // Click to expand
            row.querySelector('.expand-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDetailRow(index);
            });

            // Click row to show on map
            row.addEventListener('click', () => {
                this.highlightMarker(index);
            });

            tbody.appendChild(row);

            // Detail row (initially hidden)
            const detailRow = document.createElement('tr');
            detailRow.classList.add('detail-row');
            detailRow.style.display = 'none';
            detailRow.dataset.index = index;

            const detailContent = this.generateDetailContent(point);
            detailRow.innerHTML = `<td colspan="10">${detailContent}</td>`;

            tbody.appendChild(detailRow);
        });
    }

    generateDetailContent(point) {
        const weather = point.rawData;
        let html = '<div class="detail-content"><div class="day-breakdown">';

        for (let i = 0; i < weather.time.length; i++) {
            const date = new Date(weather.time[i]);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            const tempMax = weather.temperature_2m_max[i];
            const tempMin = weather.temperature_2m_min[i];
            const rain = weather.precipitation_sum[i];
            const rainChance = weather.precipitation_probability_max[i];
            const sun = (weather.sunshine_duration[i] / 3600).toFixed(1);
            const wind = weather.windspeed_10m_max[i];
            const humidity = weather.relative_humidity_2m_mean[i];

            html += `
                <div class="day-card">
                    <h4>${dayName}</h4>
                    <p><span>🌡️ Temp:</span> <strong>${tempMin}°C - ${tempMax}°C</strong></p>
                    <p><span>☀️ Sun:</span> <strong>${sun}h</strong></p>
                    <p><span>🌧️ Rain:</span> <strong>${rain}mm (${rainChance}%)</strong></p>
                    <p><span>💨 Wind:</span> <strong>${wind} km/h</strong></p>
                    <p><span>💧 Humidity:</span> <strong>${humidity}%</strong></p>
                </div>
            `;
        }

        html += '</div></div>';
        return html;
    }

    toggleDetailRow(index) {
        const dataRow = document.querySelector(`tr.data-row[data-index="${index}"]`);
        const detailRow = document.querySelector(`tr.detail-row[data-index="${index}"]`);

        if (detailRow.style.display === 'none') {
            detailRow.style.display = 'table-row';
            dataRow.classList.add('expanded');
        } else {
            detailRow.style.display = 'none';
            dataRow.classList.remove('expanded');
        }
    }

    highlightMarker(index) {
        const point = this.weatherData[index];

        // Pan to marker and open popup
        this.map.setView([point.lat, point.lon], 10);
        this.markers[index].openPopup();

        // Highlight table row
        document.querySelectorAll('.data-row').forEach(row => {
            row.classList.remove('selected');
        });
        document.querySelector(`.data-row[data-index="${index}"]`).classList.add('selected');

        // Scroll to map
        document.getElementById('mapContainer').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    handleSort(column) {
        // Toggle sort direction
        if (this.currentSortColumn === column) {
            this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSortColumn = column;
            this.currentSortDirection = 'desc';
        }

        // Update header indicators
        document.querySelectorAll('th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
        });

        const currentTh = document.querySelector(`th[data-column="${column}"]`);
        currentTh.classList.add(`sorted-${this.currentSortDirection}`);

        // Sort data
        this.weatherData.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            if (this.currentSortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Update ranks
        this.weatherData.forEach((item, index) => {
            item.rank = index + 1;
        });

        // Redisplay
        this.displayInTable();
        this.displayOnMap();
    }

    getColorForScore(score) {
        if (score >= 90) return '#10b981'; // Excellent - Green
        if (score >= 70) return '#6366f1'; // Good - Indigo
        if (score >= 50) return '#f59e0b'; // Fair - Orange
        return '#ef4444'; // Poor - Red
    }

    getScoreClass(score) {
        if (score >= 90) return 'score-excellent';
        if (score >= 70) return 'score-good';
        if (score >= 50) return 'score-fair';
        return 'score-poor';
    }

    showLoading(show) {
        const loading = document.getElementById('loadingIndicator');
        const searchBtn = document.getElementById('searchBtn');

        if (show) {
            loading.classList.remove('hidden');
            searchBtn.disabled = true;
        } else {
            loading.classList.add('hidden');
            searchBtn.disabled = false;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherChaser();
});
