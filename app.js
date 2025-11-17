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
        this.routePolyline = null;
        this.routeMarkers = [];
        this.currentRoute = null;

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

        // Route builder
        const buildRouteBtn = document.getElementById('buildRouteBtn');
        if (buildRouteBtn) {
            buildRouteBtn.addEventListener('click', () => this.buildRoute());
        }
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
        // Process requests in batches to avoid rate limiting
        const batchSize = 5;
        const delayBetweenBatches = 1000; // 1 second
        const results = [];

        for (let i = 0; i < gridPoints.length; i += batchSize) {
            const batch = gridPoints.slice(i, i + batchSize);
            const batchPromises = batch.map(point => this.fetchWeatherForPoint(point, days));

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches (except for the last batch)
            if (i + batchSize < gridPoints.length) {
                await this.sleep(delayBetweenBatches);
            }

            // Update progress indicator if available
            const progress = Math.min(100, Math.round((results.length / gridPoints.length) * 100));
            console.log(`Weather data progress: ${progress}%`);
        }

        return results;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchWeatherForPoint(point, days, retryCount = 0) {
        // Open-Meteo API with enhanced weather data
        const url = `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${point.lat}&longitude=${point.lon}` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunshine_duration,windspeed_10m_max` +
            `&timezone=auto&forecast_days=${days}`;

        try {
            const response = await fetch(url);

            if (response.status === 429 && retryCount < 3) {
                // Rate limited - wait and retry with exponential backoff
                const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                console.log(`Rate limited for point ${point.index}, retrying in ${waitTime}ms...`);
                await this.sleep(waitTime);
                return this.fetchWeatherForPoint(point, days, retryCount + 1);
            }

            if (!response.ok) {
                throw new Error(`Weather API error for point ${point.index}: ${response.status}`);
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

        // Show route builder section if we have enough data
        const routeSection = document.getElementById('routeBuilderSection');
        if (routeSection && this.weatherData.length >= 2) {
            routeSection.classList.remove('hidden');
            // Populate start location dropdown with grid points
            this.populateStartLocationDropdown();
        }

        // Scroll to results
        document.getElementById('resultsSection').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    populateStartLocationDropdown() {
        const dropdown = document.getElementById('startLocation');

        // Clear existing options except the first (default) one
        dropdown.innerHTML = '<option value="">Start from best weather spot</option>';

        // Add an option for each weather data point
        this.weatherData.forEach((point, index) => {
            const option = document.createElement('option');
            option.value = index;

            // Create a descriptive label with rank, location, and score
            const locationLabel = point.location || `${point.lat.toFixed(2)}, ${point.lon.toFixed(2)}`;
            option.textContent = `#${point.rank} - ${locationLabel} (Score: ${point.score})`;

            dropdown.appendChild(option);
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

            // Calculate bar widths for rain visualization
            const maxRain = 50; // mm - max for visualization
            const rainAmountBarWidth = Math.min((point.rainAmount / maxRain) * 100, 100);
            const rainChanceBarWidth = Math.min(point.rainChance, 100);

            row.innerHTML = `
                <td><span class="expand-icon">▶</span></td>
                <td>${point.rank}</td>
                <td><span class="score-badge ${this.getScoreClass(point.score)}">${point.score}</span></td>
                <td>${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}</td>
                <td>${point.avgTemp}°C</td>
                <td>${point.sunHours}h</td>
                <td>
                    <div class="table-rain-cell">
                        <span class="rain-value">${point.rainAmount}mm</span>
                        <div class="rain-bar-container">
                            <div class="rain-bar" style="width: ${rainAmountBarWidth}%"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="table-rain-cell">
                        <span class="rain-value">${point.rainChance}%</span>
                        <div class="rain-bar-container">
                            <div class="rain-bar" style="width: ${rainChanceBarWidth}%"></div>
                        </div>
                    </div>
                </td>
                <td>${point.windSpeed} km/h</td>
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
            detailRow.innerHTML = `<td colspan="9">${detailContent}</td>`;

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
            const avgTemp = (tempMax + tempMin) / 2;
            const rain = weather.precipitation_sum[i] || 0;
            const rainChance = weather.precipitation_probability_max[i] || 0;
            const sunHours = (weather.sunshine_duration[i] / 3600);
            const wind = weather.windspeed_10m_max[i];

            // Calculate daily score
            const dailyScore = this.calculateDailyScore(rain, rainChance, sunHours, avgTemp, wind);

            // Get weather emoji
            const weatherEmoji = this.getWeatherEmoji(rain, rainChance, sunHours, tempMax, tempMin);

            // Create precipitation bar
            const maxRain = 50; // mm - max for visualization
            const rainBarWidth = Math.min((rain / maxRain) * 100, 100);

            html += `
                <div class="day-card">
                    <div class="day-header">
                        <h4>${dayName}</h4>
                        <div class="day-score">
                            <span class="weather-emoji">${weatherEmoji}</span>
                            <span class="score-badge ${this.getScoreClass(dailyScore)}">${dailyScore}</span>
                        </div>
                    </div>
                    <div class="weather-details">
                        <p><span>🌡️ Temp:</span> <strong>${tempMin}°C - ${tempMax}°C</strong></p>
                        <p><span>☀️ Sun:</span> <strong>${sunHours.toFixed(1)}h</strong></p>
                        <div class="rain-detail">
                            <p><span>🌧️ Rain:</span> <strong>${rain}mm (${rainChance}%)</strong></p>
                            <div class="rain-bar-container">
                                <div class="rain-bar" style="width: ${rainBarWidth}%"></div>
                            </div>
                        </div>
                        <p><span>💨 Wind:</span> <strong>${wind} km/h</strong></p>
                    </div>
                </div>
            `;
        }

        html += '</div></div>';
        return html;
    }

    calculateDailyScore(rain, rainChance, sunHours, avgTemp, wind) {
        // Same weights as overall score
        const rainAmountScore = Math.max(0, 100 - (rain * 10));
        const rainChanceScore = Math.max(0, 100 - rainChance);
        const sunScore = Math.min(100, (sunHours / 12) * 100);
        const tempScore = this.calculateTempScore(avgTemp);
        const windScore = Math.max(0, 100 - (wind * 2));

        const totalScore = (
            rainAmountScore * 0.25 +
            rainChanceScore * 0.25 +
            sunScore * 0.30 +
            tempScore * 0.15 +
            windScore * 0.05
        );

        return Math.round(totalScore);
    }

    getWeatherEmoji(rain, rainChance, sunHours, tempMax, tempMin) {
        // Snow (cold + precipitation)
        if (tempMax <= 2 && (rain > 0 || rainChance > 30)) {
            return '❄️';
        }

        // Heavy rain
        if (rain > 10 || rainChance > 70) {
            return '🌧️';
        }

        // Light rain or drizzle
        if (rain > 2 || rainChance > 40) {
            return '🌦️';
        }

        // Cloudy (less sun)
        if (sunHours < 4) {
            return '☁️';
        }

        // Partly cloudy
        if (sunHours < 8) {
            return '⛅';
        }

        // Sunny
        return '☀️';
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

    // Route Builder Functions

    async buildRoute() {
        if (!this.weatherData || this.weatherData.length < 2) {
            alert('Need at least 2 weather spots to build a route');
            return;
        }

        const maxTravelPerDay = parseFloat(document.getElementById('maxTravelPerDay').value);
        const days = parseInt(document.getElementById('days').value);
        const startLocationIndex = document.getElementById('startLocation').value;

        this.showLoading(true);

        try {
            let startPoint = null;

            // Get start location if specified (from dropdown selection)
            if (startLocationIndex !== '') {
                const selectedPoint = this.weatherData[parseInt(startLocationIndex)];
                startPoint = { lat: selectedPoint.lat, lon: selectedPoint.lon };
            }

            // Build optimized route
            const route = await this.optimizeRoute(this.weatherData, maxTravelPerDay, days, startPoint);

            if (route.length === 0) {
                alert('Could not build a valid route with the given constraints');
                return;
            }

            this.currentRoute = route;

            // Display route on map
            this.displayRoute(route);

            // Display itinerary
            this.displayItinerary(route);

        } catch (error) {
            console.error('Route building error:', error);
            alert('Error building route: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async optimizeRoute(weatherData, maxTravelPerDay, totalDays, startPoint) {
        const route = [];
        const visited = new Set();
        const sortedSpots = [...weatherData].sort((a, b) => b.score - a.score);

        // Find starting point
        let currentPoint;
        if (startPoint) {
            currentPoint = startPoint;
        } else {
            // Start from best weather spot
            currentPoint = sortedSpots[0];
            route.push({
                day: 1,
                location: currentPoint,
                distance: 0,
                driveTime: 0,
                weather: currentPoint.rawData
            });
            visited.add(0);
        }

        // Build route day by day
        for (let day = startPoint ? 1 : 2; day <= totalDays && route.length < sortedSpots.length; day++) {
            const nextLocation = await this.findNextBestLocation(
                currentPoint,
                sortedSpots,
                visited,
                maxTravelPerDay,
                route.length > 0 ? route[route.length - 1].location : null
            );

            if (!nextLocation) {
                break; // No more reachable locations
            }

            // Get actual road distance and duration
            const roadInfo = await this.calculateRoadDistance(
                currentPoint.lat,
                currentPoint.lon,
                nextLocation.location.lat,
                nextLocation.location.lon
            );

            // Handle both object (with distance/duration) and number (fallback) returns
            const distance = typeof roadInfo === 'object' ? roadInfo.distance : roadInfo;
            const driveTime = typeof roadInfo === 'object' ? roadInfo.duration : (distance / 80 * 60);

            route.push({
                day: day,
                location: nextLocation.location,
                distance: Math.round(distance),
                driveTime: Math.round(driveTime),
                weather: nextLocation.location.rawData
            });

            visited.add(nextLocation.index);
            currentPoint = nextLocation.location;
        }

        return route;
    }

    async findNextBestLocation(currentPoint, sortedSpots, visited, maxTravel, previousLocation) {
        let bestOption = null;
        let bestScore = -1;

        // Use air distance for initial filtering to avoid too many API calls
        const candidatesInRange = [];
        for (let i = 0; i < sortedSpots.length; i++) {
            if (visited.has(i)) continue;

            const candidate = sortedSpots[i];
            const airDistance = this.calculateDistance(
                currentPoint.lat,
                currentPoint.lon,
                candidate.lat,
                candidate.lon
            );

            // Filter by air distance (add 20% buffer for road distance)
            if (airDistance <= maxTravel * 1.2) {
                candidatesInRange.push({ candidate, index: i, airDistance });
            }
        }

        // Check road distance for candidates in range
        for (const { candidate, index, airDistance } of candidatesInRange) {
            // Get actual road distance
            const roadInfo = await this.calculateRoadDistance(
                currentPoint.lat,
                currentPoint.lon,
                candidate.lat,
                candidate.lon
            );

            const distance = typeof roadInfo === 'object' ? roadInfo.distance : roadInfo;

            // Check if within max travel distance
            if (distance > maxTravel) continue;

            // Calculate direction penalty to avoid zigzagging
            let directionPenalty = 0;
            if (previousLocation) {
                const backtrackDistance = this.calculateDistance(
                    candidate.lat,
                    candidate.lon,
                    previousLocation.lat,
                    previousLocation.lon
                );

                // Penalty if going back towards previous location
                if (backtrackDistance < distance) {
                    directionPenalty = 20;
                }
            }

            // Score: weather score + distance efficiency - direction penalty
            const distanceScore = ((maxTravel - distance) / maxTravel) * 30;
            const totalScore = candidate.score + distanceScore - directionPenalty;

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestOption = { location: candidate, index };
            }
        }

        return bestOption;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula for distance in km (air distance)
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async calculateRoadDistance(lat1, lon1, lat2, lon2) {
        // Use OSRM (Open Source Routing Machine) to get actual road distance
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
            const response = await fetch(url);

            if (!response.ok) {
                // Fallback to air distance if API fails
                console.warn('OSRM API failed, using air distance');
                return this.calculateDistance(lat1, lon1, lat2, lon2);
            }

            const data = await response.json();

            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                // OSRM returns distance in meters, convert to km
                const distanceKm = data.routes[0].distance / 1000;
                const durationSeconds = data.routes[0].duration;

                return {
                    distance: distanceKm,
                    duration: durationSeconds / 60 // Convert to minutes
                };
            } else {
                // Fallback to air distance
                return this.calculateDistance(lat1, lon1, lat2, lon2);
            }
        } catch (error) {
            console.warn('Error fetching road distance:', error);
            // Fallback to air distance
            return this.calculateDistance(lat1, lon1, lat2, lon2);
        }
    }

    displayRoute(route) {
        // Clear previous route
        if (this.routePolyline) {
            this.map.removeLayer(this.routePolyline);
        }
        this.routeMarkers.forEach(marker => this.map.removeLayer(marker));
        this.routeMarkers = [];

        // Create route line
        const routeCoords = route.map(stop => [stop.location.lat, stop.location.lon]);
        this.routePolyline = L.polyline(routeCoords, {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(this.map);

        // Add numbered markers
        route.forEach((stop, index) => {
            const marker = L.marker([stop.location.lat, stop.location.lon], {
                icon: L.divIcon({
                    className: 'route-marker',
                    html: `<div class="route-marker-inner">${index + 1}</div>`,
                    iconSize: [32, 32]
                })
            }).addTo(this.map);

            const emoji = this.getWeatherEmoji(
                this.average(stop.weather.precipitation_sum),
                this.average(stop.weather.precipitation_probability_max),
                this.average(stop.weather.sunshine_duration) / 3600,
                this.average(stop.weather.temperature_2m_max),
                this.average(stop.weather.temperature_2m_min)
            );

            marker.bindPopup(`
                <div class="weather-popup">
                    <h3>Day ${stop.day} - ${emoji}</h3>
                    <p><strong>Distance:</strong> ${stop.distance} km</p>
                    <p><strong>Score:</strong> ${stop.location.score}</p>
                    <p><strong>Temp:</strong> ${stop.location.avgTemp}°C</p>
                    <p><strong>Rain:</strong> ${stop.location.rainAmount}mm</p>
                </div>
            `);

            this.routeMarkers.push(marker);
        });

        // Fit map to route
        this.map.fitBounds(this.routePolyline.getBounds().pad(0.1));
    }

    generateGoogleMapsUrl(route) {
        // Google Maps directions URL format:
        // https://www.google.com/maps/dir/origin/waypoint1/waypoint2/.../destination
        const waypoints = route.map(stop =>
            `${stop.location.lat},${stop.location.lon}`
        ).join('/');

        return `https://www.google.com/maps/dir/${waypoints}`;
    }

    displayItinerary(route) {
        const timeline = document.getElementById('itineraryTimeline');
        timeline.innerHTML = '';

        // Calculate statistics
        const totalDistance = route.reduce((sum, stop) => sum + stop.distance, 0);
        const avgScore = route.reduce((sum, stop) => sum + stop.location.score, 0) / route.length;
        const avgSpeed = 80; // km/h average driving speed
        const totalDriveTime = Math.round(totalDistance / avgSpeed * 60); // in minutes

        document.getElementById('totalDistance').textContent = `${totalDistance} km`;
        document.getElementById('tripDuration').textContent = `${route.length} days`;
        document.getElementById('avgScore').textContent = Math.round(avgScore);

        // Set Google Maps link
        const googleMapsLink = document.getElementById('googleMapsLink');
        googleMapsLink.href = this.generateGoogleMapsUrl(route);

        // Find best weather day
        const bestDayIndex = route.reduce((maxIdx, stop, idx, arr) =>
            stop.location.score > arr[maxIdx].location.score ? idx : maxIdx, 0
        );

        // Get start date from first location's weather data
        const startDate = new Date(route[0].weather.time[0]);

        // Generate timeline
        route.forEach((stop, index) => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'itinerary-day';

            // Highlight best weather day
            if (index === bestDayIndex) {
                dayDiv.classList.add('best-day');
            }

            // Calculate date for this day
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + index);
            const dateStr = currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });

            const emoji = this.getWeatherEmoji(
                this.average(stop.weather.precipitation_sum),
                this.average(stop.weather.precipitation_probability_max),
                this.average(stop.weather.sunshine_duration) / 3600,
                this.average(stop.weather.temperature_2m_max),
                this.average(stop.weather.temperature_2m_min)
            );

            // Use actual drive time from OSRM or fallback calculation
            const driveTime = stop.driveTime || (stop.distance > 0 ? Math.round(stop.distance / avgSpeed * 60) : 0);
            const hours = Math.floor(driveTime / 60);
            const minutes = driveTime % 60;
            const driveTimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            // Create Google Maps link
            const mapsLink = `https://www.google.com/maps?q=${stop.location.lat},${stop.location.lon}`;

            dayDiv.innerHTML = `
                <div class="day-header-full">
                    <span class="day-number">Day ${stop.day}</span>
                    <span class="day-date">${dateStr}</span>
                    ${index === bestDayIndex ? '<span class="best-badge">⭐ Best Weather</span>' : ''}
                </div>
                <div class="itinerary-header">
                    <div class="location-info">
                        <h4>${emoji} Weather Score: ${stop.location.score}</h4>
                        <a href="${mapsLink}" target="_blank" class="maps-link" title="${stop.location.lat.toFixed(4)}, ${stop.location.lon.toFixed(4)}">
                            📍 View on Map
                        </a>
                    </div>
                    <div class="travel-info">
                        ${stop.distance > 0 ? `<span class="travel-badge">🚗 <strong>${stop.distance} km</strong> (~${driveTimeStr})</span>` : '<span class="travel-badge">🎯 <strong>Starting Point</strong></span>'}
                    </div>
                </div>
                <div class="weather-preview">
                    <div class="weather-mini-card">
                        <div>🌡️</div>
                        <strong>${stop.location.avgTemp}°C</strong>
                    </div>
                    <div class="weather-mini-card">
                        <div>☀️</div>
                        <strong>${stop.location.sunHours}h</strong>
                    </div>
                    <div class="weather-mini-card">
                        <div>🌧️</div>
                        <strong>${stop.location.rainAmount}mm</strong>
                    </div>
                    <div class="weather-mini-card">
                        <div>💨</div>
                        <strong>${stop.location.windSpeed} km/h</strong>
                    </div>
                </div>
            `;

            timeline.appendChild(dayDiv);
        });

        // Show itinerary section
        document.getElementById('routeItinerarySection').classList.remove('hidden');

        // Scroll to itinerary
        document.getElementById('routeItinerarySection').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherChaser();
});
