// Weather Chaser Application
class WeatherChaser {
    constructor() {
        this.map = null;
        this.markers = [];
        this.weatherData = [];
        this.currentSortColumn = null;
        this.currentSortDirection = 'desc';

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
    }

    attachEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const locationInput = document.getElementById('location');

        searchBtn.addEventListener('click', () => this.handleSearch());
        locationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // Table sorting
        document.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.column));
        });
    }

    async handleSearch() {
        const location = document.getElementById('location').value.trim();
        const radius = parseInt(document.getElementById('radius').value);
        const days = parseInt(document.getElementById('days').value);
        const gridSize = parseInt(document.getElementById('gridSize').value);

        if (!location) {
            alert('Please enter a location');
            return;
        }

        this.showLoading(true);

        try {
            // Step 1: Geocode location
            const coords = await this.geocodeLocation(location);

            // Step 2: Generate grid points
            const gridPoints = this.generateGrid(coords.lat, coords.lon, radius, gridSize);

            // Step 3: Fetch weather data for all grid points
            const weatherData = await this.fetchWeatherForGrid(gridPoints, days);

            // Step 4: Calculate scores and sort
            this.weatherData = this.calculateScores(weatherData);

            // Step 5: Display results
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

    generateGrid(centerLat, centerLon, radiusKm, gridSize) {
        const points = [];
        const gridDim = Math.sqrt(gridSize);

        // Convert radius to degrees (rough approximation)
        // 1 degree latitude ≈ 111 km
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

    async fetchWeatherForGrid(gridPoints, days) {
        const weatherPromises = gridPoints.map(point =>
            this.fetchWeatherForPoint(point, days)
        );

        return await Promise.all(weatherPromises);
    }

    async fetchWeatherForPoint(point, days) {
        // Open-Meteo API - free and no API key required
        const url = `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${point.lat}&longitude=${point.lon}` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunshine_duration,windspeed_10m_max` +
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
            // Return null data to avoid breaking the entire search
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

            const avgRainChance = this.average(weather.precipitation_probability_max);
            const totalSunHours = this.sum(weather.sunshine_duration) / 3600; // Convert seconds to hours
            const avgSunHours = totalSunHours / numDays;
            const avgWind = this.average(weather.windspeed_10m_max);

            // Calculate score with weights:
            // Rain: 40% (inverted - less rain is better)
            // Sun: 30%
            // Temperature: 20% (normalized to 0-100, optimum around 20-25°C)
            // Wind: 10% (inverted - less wind is better)

            const rainScore = Math.max(0, 100 - avgRainChance);
            const sunScore = Math.min(100, (avgSunHours / 12) * 100); // 12 hours = perfect
            const tempScore = this.calculateTempScore(avgTemp);
            const windScore = Math.max(0, 100 - (avgWind * 2)); // 50 km/h = 0 score

            const totalScore = (
                rainScore * 0.40 +
                sunScore * 0.30 +
                tempScore * 0.20 +
                windScore * 0.10
            );

            results.push({
                lat: point.lat,
                lon: point.lon,
                score: Math.round(totalScore * 10) / 10,
                avgTemp: Math.round(avgTemp * 10) / 10,
                sunHours: Math.round(avgSunHours * 10) / 10,
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
        // Score decreases as temp moves away from this range
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
                    <p><strong>Rain Chance:</strong> ${point.rainChance}%</p>
                    <p><strong>Wind:</strong> ${point.windSpeed} km/h</p>
                    <p><small>Lat: ${point.lat.toFixed(4)}, Lon: ${point.lon.toFixed(4)}</small></p>
                </div>
            `;

            marker.bindPopup(popupContent);

            // Highlight on hover
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
            const row = document.createElement('tr');
            row.dataset.index = index;

            row.innerHTML = `
                <td>${point.rank}</td>
                <td><span class="score-badge ${this.getScoreClass(point.score)}">${point.score}</span></td>
                <td>${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}</td>
                <td>${point.avgTemp}°C</td>
                <td>${point.sunHours}h</td>
                <td>${point.rainChance}%</td>
                <td>${point.windSpeed} km/h</td>
            `;

            // Click to show on map
            row.addEventListener('click', () => {
                this.highlightMarker(index);
            });

            tbody.appendChild(row);
        });
    }

    highlightMarker(index) {
        const point = this.weatherData[index];

        // Pan to marker and open popup
        this.map.setView([point.lat, point.lon], 10);
        this.markers[index].openPopup();

        // Highlight table row
        document.querySelectorAll('#resultsBody tr').forEach(row => {
            row.classList.remove('selected');
        });
        document.querySelector(`#resultsBody tr[data-index="${index}"]`).classList.add('selected');

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
        if (score >= 70) return '#3b82f6'; // Good - Blue
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
