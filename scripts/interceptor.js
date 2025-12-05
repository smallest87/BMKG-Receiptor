(function() {
    console.log("%c[BMKG-Receiptor] Status: Hunting Nuxt State...", "color: lime; font-weight: bold; font-size: 14px;");

    // Fungsi untuk memicu download file secara otomatis
    function downloadData(data) {
        const fileName = `BMKG_${data.lokasi.adm3 || 'Data'}_${new Date().toISOString().slice(0,10)}.json`;
        const jsonStr = JSON.stringify(data, null, 2);
        
        const blob = new Blob([jsonStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`%c[SUCCESS] Data downloaded as ${fileName}`, "color: #00ff00; background: #004400; padding: 4px;");
    }

    function findWeatherData(nuxtData) {
        if (!nuxtData) return null;
        for (const key in nuxtData) {
            const item = nuxtData[key];
            // Mencari pola object yang memiliki properti 'data.cuaca' dan 'data.lokasi'
            if (item && item.data && item.data.cuaca && item.data.lokasi) {
                return item.data;
            }
        }
        return null;
    }

    function extractNuxtData() {
        if (window.__NUXT__ && window.__NUXT__.data) {
            const weatherData = findWeatherData(window.__NUXT__.data);

            if (weatherData) {
                console.group("%c[BMKG-Receiptor] CAPTURED!", "background: green; color: white; padding: 5px;");
                console.log("Data:", weatherData);
                console.groupEnd();

                // EKSEKUSI DOWNLOAD
                // Kita beri delay dikit biar halaman render dulu visualnya
                setTimeout(() => downloadData(weatherData), 1000);
                
                return true; 
            }
        }
        return false;
    }

    // Loop pengecekan (Polling)
    const maxRetries = 20; // Coba selama 10 detik (20 * 500ms)
    let attempts = 0;

    const interval = setInterval(() => {
        attempts++;
        const success = extractNuxtData();

        if (success) {
            clearInterval(interval);
        } else if (attempts >= maxRetries) {
            console.warn("[BMKG-Receiptor] Timeout: Data cuaca tidak ditemukan di window.__NUXT__");
            clearInterval(interval);
        }
    }, 500);

})();