(function() {
    console.log("%c[BMKG-Receiptor] Status: Hunting Nuxt State...", "color: lime; font-weight: bold; font-size: 14px;");

    // Fungsi pencari data pintar (tidak peduli nama key acak)
    function findWeatherData(nuxtData) {
        if (!nuxtData) return null;

        // Loop semua key yang ada di dalam object 'data' (contoh: '2WYhP1zvSU', dll)
        for (const key in nuxtData) {
            const item = nuxtData[key];

            // Pengecekan Ciri-Ciri (Duck Typing):
            // Apakah item ini punya properti 'data'?
            // Dan di dalamnya ada 'cuaca' dan 'lokasi'?
            if (item && item.data && item.data.cuaca && item.data.lokasi) {
                console.log(`%c[FOUND] Weather data found in key: ${key}`, "color: yellow");
                return item.data; // Kembalikan object data bersihnya
            }
        }
        return null;
    }

    function extractNuxtData() {
        // Cek keberadaan variabel global
        if (window.__NUXT__ && window.__NUXT__.data) {
            
            const weatherData = findWeatherData(window.__NUXT__.data);

            if (weatherData) {
                console.group("%c[BMKG-Receiptor] WEATHER DATA CAPTURED", "background: green; color: white; padding: 5px; font-size: 16px;");
                
                console.log("📍 Lokasi:", weatherData.lokasi);
                console.log("🌤️ Cuaca Saat Ini:", weatherData.cuaca);
                console.log("📅 Data Lengkap:", weatherData);
                
                // --- DISINI ANDA BISA MENYIMPAN DATA ---
                // Contoh: Kirim ke server Anda sendiri atau simpan ke LocalStorage
                // sendToMyServer(weatherData); 
                
                console.groupEnd();
                return true; 
            }
        }
        return false;
    }

    // Strategi Eksekusi:
    // Coba berulang kali karena Nuxt butuh waktu milidetik untuk mengisi variabel window.__NUXT__
    const maxRetries = 10;
    let attempts = 0;

    const interval = setInterval(() => {
        attempts++;
        const success = extractNuxtData();

        if (success) {
            clearInterval(interval); // Berhenti jika data ketemu
        } else if (attempts >= maxRetries) {
            console.warn("[BMKG-Receiptor] Gagal menemukan object cuaca setelah 10x percobaan.");
            clearInterval(interval);
        }
    }, 500); // Cek setiap 500ms

})();