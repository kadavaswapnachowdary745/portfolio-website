/**
 * ==========================================================================
 * AETHERIA METEOROLOGICAL DASHBOARD - CORE CONTROLLER
 * ==========================================================================
 */

// --- DASHBOARD STATE MANAGER ---
const AppState = {
  activeCityData: null,
  searchHistory: [],
  apiSettings: {
    mode: 'mock' // 'mock' or 'openmeteo'
  },
  theme: 'dark', // 'dark' or 'light'
  clockInterval: null,
  localTimeInterval: null
};

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  body: document.body,
  themeToggle: document.getElementById('theme-toggle'),
  settingsToggle: document.getElementById('settings-toggle'),
  settingsDialog: document.getElementById('settings-dialog'),
  settingsForm: document.getElementById('settings-form'),
  apiModeSelect: document.getElementById('api-mode-select'),
  resetSettings: document.getElementById('reset-settings'),
  closeSettings: document.getElementById('close-settings'),
  
  // Search
  searchForm: document.getElementById('search-form'),
  cityInput: document.getElementById('city-input'),
  clearSearch: document.getElementById('clear-search'),
  recentList: document.getElementById('recent-list'),
  clearHistory: document.getElementById('clear-history'),
  emptyHistoryMsg: document.getElementById('empty-history-msg'),
  
  // Status Banners
  apiStatusBanner: document.getElementById('api-status-banner'),
  errorCard: document.getElementById('error-card'),
  errorMessage: document.getElementById('error-message'),
  closeError: document.getElementById('close-error'),
  loadingCard: document.getElementById('loading-card'),
  loadingMessage: document.getElementById('loading-message'),
  welcomeCard: document.getElementById('welcome-card'),
  
  // Weather Display
  weatherContent: document.getElementById('weather-content'),
  weatherCity: document.getElementById('weather-city'),
  weatherCountry: document.getElementById('weather-country'),
  weatherLocalTime: document.getElementById('weather-local-time'),
  refreshWeather: document.getElementById('refresh-weather'),
  weatherTemp: document.getElementById('weather-temp'),
  weatherDesc: document.getElementById('weather-desc'),
  weatherMain: document.getElementById('weather-main'),
  weatherIcon: document.getElementById('weather-icon'),
  weatherIconWrapper: document.getElementById('weather-icon-wrapper'),
  
  // Detailed Telemetry
  weatherFeelsLike: document.getElementById('weather-feels-like'),
  weatherHumidity: document.getElementById('weather-humidity'),
  weatherWind: document.getElementById('weather-wind'),
  windDesc: document.getElementById('wind-desc'),
  weatherPressure: document.getElementById('weather-pressure'),
  pressureDesc: document.getElementById('pressure-desc'),
  weatherVisibility: document.getElementById('weather-visibility'),
  visibilityDesc: document.getElementById('visibility-desc'),
  
  // Widgets & Footer
  currentDateTime: document.getElementById('current-date-time'),
  apiStatusBadge: document.getElementById('api-status-badge')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  initializeApiSettings();
  initializeSearchHistory();
  setupEventListeners();
  startGlobalClock();
  
  // Initial Lucide Setup
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// --- THEME MANAGEMENT ---
function initializeTheme() {
  const savedTheme = localStorage.getItem('aetheria_theme') || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  AppState.theme = theme;
  localStorage.setItem('aetheria_theme', theme);
  
  if (theme === 'light') {
    DOM.body.classList.remove('theme-dark');
    DOM.body.classList.add('theme-light');
  } else {
    DOM.body.classList.remove('theme-light');
    DOM.body.classList.add('theme-dark');
  }
}

function toggleTheme() {
  const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
}

// --- SETTINGS MANAGEMENT ---
function initializeApiSettings() {
  const savedMode = localStorage.getItem('aetheria_api_mode') || 'mock';
  
  AppState.apiSettings.mode = savedMode;
  DOM.apiModeSelect.value = savedMode;
  
  updateApiStatusElements();
}

function updateApiStatusElements() {
  const isMock = AppState.apiSettings.mode === 'mock';
  
  // Banner toggle
  if (isMock) {
    DOM.apiStatusBanner.classList.remove('hidden');
    DOM.apiStatusBadge.innerHTML = `<i data-lucide="database" class="badge-icon"></i> Mock Mode`;
  } else {
    DOM.apiStatusBanner.classList.add('hidden');
    DOM.apiStatusBadge.innerHTML = `<i data-lucide="globe" class="badge-icon"></i> Open-Meteo Live`;
  }
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// --- SEARCH HISTORY ---
function initializeSearchHistory() {
  const savedHistory = localStorage.getItem('aetheria_search_history');
  if (savedHistory) {
    try {
      AppState.searchHistory = JSON.parse(savedHistory);
      renderSearchHistory();
    } catch (e) {
      console.error("Error parsing search history from localStorage:", e);
      AppState.searchHistory = [];
    }
  }
}

function saveSearchHistory() {
  localStorage.setItem('aetheria_search_history', JSON.stringify(AppState.searchHistory));
  renderSearchHistory();
}

function addToSearchHistory(cityData) {
  // Extract key summary points to store in history
  const historyItem = {
    name: cityData.name,
    country: cityData.sys.country,
    temp: cityData.main.temp,
    icon: cityData.weather[0].icon,
    description: cityData.weather[0].main
  };
  
  // Remove duplicate items of the same city name (case-insensitive)
  AppState.searchHistory = AppState.searchHistory.filter(
    item => item.name.toLowerCase() !== historyItem.name.toLowerCase()
  );
  
  // Add to front
  AppState.searchHistory.unshift(historyItem);
  
  // Limit to maximum 6 history records
  if (AppState.searchHistory.length > 6) {
    AppState.searchHistory.pop();
  }
  
  saveSearchHistory();
}

function deleteHistoryItem(cityName, event) {
  event.stopPropagation();
  
  AppState.searchHistory = AppState.searchHistory.filter(
    item => item.name.toLowerCase() !== cityName.toLowerCase()
  );
  
  saveSearchHistory();
}

function clearAllHistory() {
  AppState.searchHistory = [];
  saveSearchHistory();
}

function renderSearchHistory() {
  DOM.recentList.innerHTML = '';
  
  if (AppState.searchHistory.length === 0) {
    DOM.emptyHistoryMsg.classList.remove('hidden');
    DOM.clearHistory.classList.add('hidden');
    DOM.recentList.appendChild(DOM.emptyHistoryMsg);
    return;
  }
  
  DOM.emptyHistoryMsg.classList.add('hidden');
  DOM.clearHistory.classList.remove('hidden');
  
  AppState.searchHistory.forEach(item => {
    const li = document.createElement('li');
    li.className = 'recent-item';
    
    // OpenWeatherMap icons works as visual key representations
    const iconUrl = `https://openweathermap.org/img/wn/${item.icon}.png`;

    li.innerHTML = `
      <button class="recent-item-btn" aria-label="Retrieve weather for ${item.name}, ${item.country}">
        <div class="recent-city-details">
          <span class="recent-city-name">${item.name}</span>
          <span class="recent-country">${item.country}</span>
        </div>
        <div class="recent-weather-summary">
          <span class="recent-temp">${Math.round(item.temp)}°C</span>
          <img src="${iconUrl}" alt="${item.description}" class="recent-icon" aria-hidden="true" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%224%22/><path d=%22M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41%22/></svg>'">
          <button class="delete-recent-btn" aria-label="Remove ${item.name} from search history">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </button>
    `;
    
    // Attach event listeners
    li.querySelector('.recent-item-btn').addEventListener('click', () => {
      fetchWeather(item.name);
    });
    
    li.querySelector('.delete-recent-btn').addEventListener('click', (e) => {
      deleteHistoryItem(item.name, e);
    });
    
    DOM.recentList.appendChild(li);
  });
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// --- API DATA FETCHING (ASYNC / FETCH / TRY-CATCH) ---
async function fetchWeather(city) {
  if (!city || city.trim() === '') {
    displayError("Please enter a valid city name.");
    return;
  }
  
  const sanitizedCity = city.trim();
  showLoading(`Updating meteorological reports for ${sanitizedCity}...`);
  hideError();
  
  try {
    let data;
    if (AppState.apiSettings.mode === 'mock') {
      data = await fetchMockWeatherData(sanitizedCity);
    } else {
      data = await fetchRealWeatherData(sanitizedCity);
    }
    
    // Parse nested structure validation
    validateAndProcessWeatherData(data);
    
  } catch (error) {
    console.error("Meteorological data retrieval failed:", error);
    displayError(error.message || "Failed to retrieve weather reports. Please verify connectivity or check city name.");
    DOM.loadingCard.classList.add('hidden');
    if (!AppState.activeCityData) {
      DOM.welcomeCard.classList.remove('hidden');
    }
  }
}

// --- FETCH MOCK METHOD ---
async function fetchMockWeatherData(city) {
  const response = await fetch('assets/mock-weather.json');
  if (!response.ok) {
    throw new Error("Local meteorological database offline.");
  }
  
  const mockDb = await response.json();
  const cityKey = city.toLowerCase();
  
  // Simulate delay to display aesthetic loading filters (600ms)
  await new Promise(resolve => setTimeout(resolve, 600));
  
  if (mockDb[cityKey]) {
    return mockDb[cityKey];
  } else {
    // Generate randomized mock response
    return generateDynamicMockData(city);
  }
}

// --- GENERATE DYNAMIC MOCK DATA ---
function generateDynamicMockData(cityName) {
  const hash = cityName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const conditions = [
    { main: 'Clear', desc: 'clear sky', icon: '01d', tempBase: 28, humidity: 40, wind: 3.2, pressure: 1014 },
    { main: 'Clouds', desc: 'scattered clouds', icon: '03d', tempBase: 20, humidity: 65, wind: 4.8, pressure: 1012 },
    { main: 'Rain', desc: 'light shower rain', icon: '09d', tempBase: 15, humidity: 85, wind: 5.5, pressure: 1008 },
    { main: 'Thunderstorm', desc: 'severe lightning storm', icon: '11d', tempBase: 24, humidity: 90, wind: 9.2, pressure: 1004 },
    { main: 'Snow', desc: 'light drifting snow', icon: '13d', tempBase: -2, humidity: 75, wind: 6.0, pressure: 1010 },
    { main: 'Mist', desc: 'heavy fog banks', icon: '50d', tempBase: 12, humidity: 95, wind: 1.5, pressure: 1016 }
  ];
  
  const selectedConfig = conditions[hash % conditions.length];
  const tempVariance = (hash % 15) - 7.5;
  const finalTemp = Math.round((selectedConfig.tempBase + tempVariance) * 10) / 10;
  const finalFeels = Math.round((finalTemp + (hash % 4) - 2) * 10) / 10;
  
  return {
    name: cityName.charAt(0).toUpperCase() + cityName.slice(1),
    coord: { lon: (hash % 360) - 180, lat: (hash % 180) - 90 },
    weather: [
      {
        id: hash % 900,
        main: selectedConfig.main,
        description: selectedConfig.desc,
        icon: selectedConfig.icon
      }
    ],
    main: {
      temp: finalTemp,
      feels_like: finalFeels,
      pressure: selectedConfig.pressure,
      humidity: selectedConfig.humidity
    },
    visibility: 10000 - (hash % 8000),
    wind: {
      speed: Math.round((selectedConfig.wind + (hash % 3)) * 10) / 10
    },
    sys: {
      country: ['US', 'IN', 'GB', 'DE', 'JP', 'AU', 'BR', 'CA'][hash % 8]
    },
    timezone: ((hash % 24) - 12) * 3600,
    cod: 200
  };
}

// --- FETCH REAL OPEN-METEO DATA (Sequential Geocode + Forecast Fetch with Adapter mapping) ---
async function fetchRealWeatherData(city) {
  // Step 1: Query Geocoding service to obtain coordinates and location parameters
  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  
  const geocodeResponse = await fetch(geocodeUrl);
  if (!geocodeResponse.ok) {
    throw new Error("Geocoding service unavailable.");
  }
  
  const geocodeData = await geocodeResponse.json();
  if (!geocodeData.results || geocodeData.results.length === 0) {
    throw new Error(`City "${city}" not found. Please verify spelling.`);
  }
  
  const location = geocodeData.results[0];
  
  // Step 2: Query Weather Forecast service using retrieved coordinates
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,surface_pressure,visibility&wind_speed_unit=ms&timezone=auto`;
  
  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) {
    throw new Error("Atmospheric telemetry database offline.");
  }
  
  const forecastData = await forecastResponse.json();
  
  // Step 3: Run Adapter translation to match the expected nested OpenWeatherMap schema
  return mapOpenMeteoToOpenWeather(location, forecastData);
}

// --- DATA ADAPTER LAYER: OPEN-METEO TO OPENWEATHER SCHEMAS ---
function mapOpenMeteoToOpenWeather(location, forecast) {
  const current = forecast.current;
  const weatherCode = current.weather_code;
  const isDay = current.is_day;
  
  // WMO Weather code mapper
  const wmoMap = {
    0: { main: 'Clear', desc: 'clear sky', icon: '01' },
    1: { main: 'Clouds', desc: 'mainly clear', icon: '02' },
    2: { main: 'Clouds', desc: 'partly cloudy', icon: '03' },
    3: { main: 'Clouds', desc: 'overcast', icon: '04' },
    45: { main: 'Mist', desc: 'fog', icon: '50' },
    48: { main: 'Mist', desc: 'depositing rime fog', icon: '50' },
    51: { main: 'Rain', desc: 'light drizzle', icon: '09' },
    53: { main: 'Rain', desc: 'moderate drizzle', icon: '09' },
    55: { main: 'Rain', desc: 'dense drizzle', icon: '09' },
    56: { main: 'Snow', desc: 'light freezing drizzle', icon: '13' },
    57: { main: 'Snow', desc: 'dense freezing drizzle', icon: '13' },
    61: { main: 'Rain', desc: 'slight rain', icon: '10' },
    63: { main: 'Rain', desc: 'moderate rain', icon: '10' },
    65: { main: 'Rain', desc: 'heavy rain', icon: '10' },
    66: { main: 'Snow', desc: 'light freezing rain', icon: '13' },
    67: { main: 'Snow', desc: 'heavy freezing rain', icon: '13' },
    71: { main: 'Snow', desc: 'slight snow fall', icon: '13' },
    73: { main: 'Snow', desc: 'moderate snow fall', icon: '13' },
    75: { main: 'Snow', desc: 'heavy snow fall', icon: '13' },
    77: { main: 'Snow', desc: 'snow grains', icon: '13' },
    80: { main: 'Rain', desc: 'slight rain showers', icon: '09' },
    81: { main: 'Rain', desc: 'moderate rain showers', icon: '09' },
    82: { main: 'Rain', desc: 'violent rain showers', icon: '09' },
    85: { main: 'Snow', desc: 'slight snow showers', icon: '13' },
    86: { main: 'Snow', desc: 'heavy snow showers', icon: '13' },
    95: { main: 'Thunderstorm', desc: 'thunderstorm', icon: '11' },
    96: { main: 'Thunderstorm', desc: 'thunderstorm with hail', icon: '11' },
    99: { main: 'Thunderstorm', desc: 'thunderstorm with heavy hail', icon: '11' }
  };
  
  const wmo = wmoMap[weatherCode] || { main: 'Clouds', desc: 'unspecified conditions', icon: '03' };
  const dayNight = isDay === 1 ? 'd' : 'n';
  const iconCode = `${wmo.icon}${dayNight}`;
  
  // Format matching structural requirement: sys{}, main{}, wind{}, weather[]
  return {
    name: location.name,
    coord: { lon: location.longitude, lat: location.latitude },
    weather: [
      {
        id: weatherCode,
        main: wmo.main,
        description: wmo.desc,
        icon: iconCode
      }
    ],
    main: {
      temp: current.temperature_2m,
      feels_like: current.apparent_temperature,
      pressure: current.surface_pressure,
      humidity: current.relative_humidity_2m
    },
    visibility: current.visibility,
    wind: {
      speed: current.wind_speed_10m
    },
    sys: {
      country: location.country_code || 'UN'
    },
    timezone: forecast.utc_offset_seconds || 0,
    cod: 200
  };
}

// --- JSON PROCESSING & VALIDATION ---
function validateAndProcessWeatherData(data) {
  // Validate nested JSON structural presence (weather[], main{}, wind{}, sys{})
  if (!data || !data.weather || !data.weather[0] || !data.main || !data.wind || !data.sys) {
    throw new Error("Retrieved JSON structures are incomplete or malformed.");
  }
  
  AppState.activeCityData = data;
  
  // Render updates to UI
  renderWeatherDashboard(data);
  
  // Add successful fetch to History
  addToSearchHistory(data);
}

// --- UI RENDERING ENGINE ---
function renderWeatherDashboard(data) {
  // Extract fields from nested structures
  const cityName = data.name;
  const country = data.sys.country;
  const temp = data.main.temp;
  const feelsLike = data.main.feels_like;
  const humidity = data.main.humidity;
  const pressure = data.main.pressure;
  const windSpeed = data.wind.speed;
  const visibilityInMeters = data.visibility;
  
  const mainCondition = data.weather[0].main;
  const description = data.weather[0].description;
  const iconCode = data.weather[0].icon;
  const timezoneOffset = data.timezone; // in seconds

  // Update text tags
  DOM.weatherCity.textContent = cityName;
  DOM.weatherCountry.textContent = country;
  DOM.weatherTemp.textContent = temp.toFixed(1);
  DOM.weatherDesc.textContent = description;
  DOM.weatherMain.textContent = mainCondition;
  
  DOM.weatherFeelsLike.textContent = feelsLike.toFixed(1);
  DOM.weatherHumidity.textContent = humidity;
  DOM.weatherWind.textContent = windSpeed.toFixed(1);
  DOM.weatherPressure.textContent = pressure;
  
  // Convert visibility from meters to kilometers
  const visibilityKm = (visibilityInMeters / 1000).toFixed(1);
  DOM.weatherVisibility.textContent = visibilityKm;

  // Add descriptive summaries dynamically
  DOM.windDesc.textContent = getWindClassification(windSpeed);
  DOM.pressureDesc.textContent = getPressureClassification(pressure);
  DOM.visibilityDesc.textContent = getVisibilityClassification(visibilityInMeters);

  // Set weather icons
  DOM.weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
  DOM.weatherIcon.alt = `Visual depiction of: ${description}`;

  // Update Local Time of searched city
  updateCityLocalTime(timezoneOffset);

  // Update Dynamic Theme background
  updateDynamicBackground(mainCondition);

  // Transition UI displays
  DOM.loadingCard.classList.add('hidden');
  DOM.welcomeCard.classList.add('hidden');
  DOM.weatherContent.classList.remove('hidden');
}

// --- DYNAMIC BACKGROUND CONTROLLER ---
function updateDynamicBackground(condition) {
  DOM.body.classList.remove(
    'weather-clear', 
    'weather-clouds', 
    'weather-rain', 
    'weather-thunderstorm', 
    'weather-snow', 
    'weather-mist'
  );
  
  const lowerCondition = condition.toLowerCase();
  
  if (lowerCondition.includes('clear')) {
    DOM.body.classList.add('weather-clear');
  } else if (lowerCondition.includes('cloud')) {
    DOM.body.classList.add('weather-clouds');
  } else if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) {
    DOM.body.classList.add('weather-rain');
  } else if (lowerCondition.includes('thunderstorm')) {
    DOM.body.classList.add('weather-thunderstorm');
  } else if (lowerCondition.includes('snow')) {
    DOM.body.classList.add('weather-snow');
  } else if (
    lowerCondition.includes('mist') || 
    lowerCondition.includes('fog') || 
    lowerCondition.includes('haze') || 
    lowerCondition.includes('smoke') || 
    lowerCondition.includes('dust') || 
    lowerCondition.includes('ash') || 
    lowerCondition.includes('squall') || 
    lowerCondition.includes('tornado')
  ) {
    DOM.body.classList.add('weather-mist');
  }
}

// --- DYNAMIC METRIC INTERPRETATION ---
function getWindClassification(speed) {
  if (speed < 0.3) return "Calm air currents";
  if (speed < 1.5) return "Light air movement";
  if (speed < 3.3) return "Gentle, light breeze";
  if (speed < 5.4) return "Pleasant gentle breeze";
  if (speed < 7.9) return "Moderate breeze";
  if (speed < 10.7) return "Fresh breeze";
  return "Strong gale wind indicators";
}

function getPressureClassification(pressure) {
  if (pressure < 1009) return "Low pressure system";
  if (pressure > 1020) return "High pressure zone";
  return "Standard atmospheric weight";
}

function getVisibilityClassification(meters) {
  if (meters < 1000) return "Extremely poor vision";
  if (meters < 4000) return "Foggy visibility conditions";
  if (meters < 10000) return "Hazy mist layers";
  return "Clear visual clearance";
}

// --- CLOCK AND TIME MANAGEMENT ---
function startGlobalClock() {
  if (AppState.clockInterval) {
    clearInterval(AppState.clockInterval);
  }
  
  const updateClock = () => {
    const now = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    };
    DOM.currentDateTime.textContent = now.toLocaleDateString('en-US', options);
  };
  
  updateClock();
  AppState.clockInterval = setInterval(updateClock, 1000);
}

function updateCityLocalTime(timezoneOffsetSeconds) {
  if (AppState.localTimeInterval) {
    clearInterval(AppState.localTimeInterval);
  }
  
  const tickLocalTime = () => {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const cityLocalTime = new Date(utcTime + (timezoneOffsetSeconds * 1000));
    
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const dateOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    };
    
    const timeString = cityLocalTime.toLocaleTimeString('en-US', timeOptions);
    const dateString = cityLocalTime.toLocaleDateString('en-US', dateOptions);
    
    DOM.weatherLocalTime.textContent = `Local Date & Time: ${dateString}, ${timeString}`;
  };
  
  tickLocalTime();
  AppState.localTimeInterval = setInterval(tickLocalTime, 1000);
}

// --- VIEW HELPER ROUTINES ---
function showLoading(msg) {
  DOM.loadingMessage.textContent = msg;
  DOM.loadingCard.classList.remove('hidden');
  DOM.welcomeCard.classList.add('hidden');
  DOM.weatherContent.classList.add('hidden');
}

function displayError(msg) {
  DOM.errorMessage.textContent = msg;
  DOM.errorCard.classList.remove('hidden');
  DOM.errorCard.focus();
}

function hideError() {
  DOM.errorCard.classList.add('hidden');
}

// --- EVENT BINDINGS ---
function setupEventListeners() {
  // Theme toggle button
  DOM.themeToggle.addEventListener('click', toggleTheme);
  
  // Settings Dialog toggle buttons
  DOM.settingsToggle.addEventListener('click', () => {
    DOM.settingsDialog.showModal();
  });
  
  DOM.closeSettings.addEventListener('click', () => {
    DOM.settingsDialog.close();
  });
  
  // Close when clicking outside dialog window boundary (glass blur zone)
  DOM.settingsDialog.addEventListener('click', (e) => {
    const dialogDimensions = DOM.settingsDialog.getBoundingClientRect();
    if (
      e.clientX < dialogDimensions.left ||
      e.clientX > dialogDimensions.right ||
      e.clientY < dialogDimensions.top ||
      e.clientY > dialogDimensions.bottom
    ) {
      DOM.settingsDialog.close();
    }
  });

  // Reset Settings defaults
  DOM.resetSettings.addEventListener('click', () => {
    DOM.apiModeSelect.value = 'mock';
  });

  // Save Settings actions
  DOM.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nextMode = DOM.apiModeSelect.value;
    
    localStorage.setItem('aetheria_api_mode', nextMode);
    AppState.apiSettings.mode = nextMode;
    
    DOM.settingsDialog.close();
    updateApiStatusElements();
    
    // Refresh weather if search was active
    if (AppState.activeCityData) {
      fetchWeather(AppState.activeCityData.name);
    }
  });

  // Search input actions
  DOM.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = DOM.cityInput.value.trim();
    if (city === '') {
      displayError("Search input is empty. Please specify a city name.");
      return;
    }
    fetchWeather(city);
  });
  
  // Show input clear button dynamically on typing
  DOM.cityInput.addEventListener('input', (e) => {
    if (e.target.value.length > 0) {
      DOM.clearSearch.classList.remove('hidden');
    } else {
      DOM.clearSearch.classList.add('hidden');
    }
  });

  // Clear search input action button
  DOM.clearSearch.addEventListener('click', () => {
    DOM.cityInput.value = '';
    DOM.cityInput.focus();
    DOM.clearSearch.classList.add('hidden');
  });

  // Welcome page quick city recommendations buttons
  document.querySelectorAll('.welcome-quick-city').forEach(button => {
    button.addEventListener('click', (e) => {
      const city = e.target.getAttribute('data-city');
      DOM.cityInput.value = city;
      DOM.clearSearch.classList.remove('hidden');
      fetchWeather(city);
    });
  });

  // Clear history buttons
  DOM.clearHistory.addEventListener('click', clearAllHistory);

  // Close errors banner manually
  DOM.closeError.addEventListener('click', hideError);

  // Refresh Weather active details button
  DOM.refreshWeather.addEventListener('click', () => {
    if (AppState.activeCityData) {
      fetchWeather(AppState.activeCityData.name);
    }
  });
}
