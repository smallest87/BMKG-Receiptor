(function() {
    console.log("%c[BMKG-Receiptor] Phase: Nuxt 3 Payload Extraction", "color: lime; font-weight: bold; font-size: 14px;");

    // --- DECODER ENGINE ---
    // Fungsi ini mengubah "Angka Index" menjadi "Nilai Sebenarnya" dari Array Induk
    function resolveValue(sourceArray, value) {
        // Jika value adalah angka dan valid sebagai index array, ambil isinya
        if (typeof value === 'number' && value < sourceArray.length && value >= 0) {
            return sourceArray[value];
        }
        // Jika bukan index (misal null atau string langsung), kembalikan aslinya
        return value;
    }

    // Fungsi untuk mendeteksi apakah sebuah object adalah data cuaca
    function isWeatherObject(obj) {
        // Ciri khas data cuaca BMKG: Punya index untuk suhu (t), kelembapan (hu), dan waktu (local_datetime/datetime)
        // Kita cek keberadaan propertinya
        return obj && typeof obj === 'object' && ('t' in obj) && ('hu' in obj) && ('ws' in obj);
    }

    // Fungsi untuk mendeteksi apakah sebuah object adalah data lokasi
    function isLocationObject(obj, sourceArray) {
        // Ciri khas lokasi: punya properti desa, kecamatan, provinsi
        // Karena nilai propertinya masih index, kita harus agak longgar pengecekannya
        return obj && typeof obj === 'object' && ('desa' in obj) && ('kecamatan' in obj) && ('provinsi' in obj);
    }

    function processNuxtData() {
        const scriptElement = document.getElementById('__NUXT_DATA__');
        
        if (!scriptElement) {
            console.warn("[BMKG-Receiptor] Payload __NUXT_DATA__ belum ditemukan. Retrying...");
            return false;
        }

        try {
            const rawData = JSON.parse(scriptElement.textContent);
            console.log(`[BMKG-Receiptor] Payload Raw Size: ${rawData.length} items`);

            let locationInfo = null;
            let weatherData = [];

            // --- SCANNING & DECODING ---
            // Kita loop seluruh isi array Nuxt untuk mencari potongan puzzle
            rawData.forEach(item => {
                if (!item) return;

                // 1. Coba Decode Lokasi
                if (!locationInfo && isLocationObject(item)) {
                    locationInfo = {
                        provinsi: resolveValue(rawData, item.provinsi),
                        kabupaten: resolveValue(rawData, item.kotkab),
                        kecamatan: resolveValue(rawData, item.kecamatan),
                        desa: resolveValue(rawData, item.desa),
                        koordinat: {
                            lat: resolveValue(rawData, item.lat),
                            lon: resolveValue(rawData, item.lon)
                        },
                        timezone: resolveValue(rawData, item.timezone)
                    };
                }

                // 2. Coba Decode Data Cuaca (Per Jam / Harian)
                if (isWeatherObject(item)) {
                    const decodedItem = {
                        waktu_lokal: resolveValue(rawData, item.local_datetime),
                        waktu_utc: resolveValue(rawData, item.datetime || item.utc_datetime),
                        suhu: resolveValue(rawData, item.t),
                        kelembapan: resolveValue(rawData, item.hu),
                        kecepatan_angin: resolveValue(rawData, item.ws), // km/jam biasanya
                        arah_angin: resolveValue(rawData, item.wd), // Cardinal (misal: SE, NW)
                        arah_angin_deg: resolveValue(rawData, item.wd_deg),
                        cuaca: resolveValue(rawData, item.weather_desc || item.weather_desc_en),
                        kode_cuaca: resolveValue(rawData, item.weather),
                        jarak_pandang: resolveValue(rawData, item.vs_text)
                    };

                    // Filter sampah: Pastikan 'suhu' adalah angka valid, bukan function atau undefined
                    if (typeof decodedItem.suhu === 'number') {
                        weatherData.push(decodedItem);
                    }
                }
            });

            // Sorting berdasarkan waktu agar rapi
            weatherData.sort((a, b) => new Date(a.waktu_lokal) - new Date(b.waktu_lokal));

            // Hapus duplikat (kadang Nuxt menyimpan data yg sama di pointer berbeda)
            weatherData = weatherData.filter((v,i,a)=>a.findIndex(t=>(t.waktu_lokal === v.waktu_lokal))===i);

            if (weatherData.length > 0) {
                console.clear(); // Bersihkan console biar fokus
                console.group("%c[BMKG-Receiptor] EXTRACTION SUCCESS", "background: #004400; color: #00ff00; padding: 5px; font-size: 16px;");
                
                console.log("%cINFO LOKASI:", "color: yellow; font-weight: bold;", locationInfo);
                
                console.log("%cDATA DETAIL (Hourly & Daily):", "color: cyan; font-weight: bold;");
                console.table(weatherData, ['waktu_lokal', 'suhu', 'cuaca', 'kelembapan', 'arah_angin', 'kecepatan_angin']);
                
                console.groupEnd();

                // Auto Download JSON
                const finalPayload = {
                    meta: {
                        timestamp_ambil: new Date().toISOString(),
                        sumber: window.location.href
                    },
                    lokasi: locationInfo,
                    data_cuaca: weatherData
                };

                const blob = new Blob([JSON.stringify(finalPayload, null, 2)], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `BMKG_FULL_${locationInfo?.desa || 'Data'}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                return true; // Sukses
            }

        } catch (e) {
            console.error("[BMKG-Receiptor] Decoding Error:", e);
        }
        return false;
    }

    // --- EXECUTION STRATEGY ---
    // Gunakan Polling karena script tag mungkin belum siap saat 'document_start'
    let attempts = 0;
    const maxAttempts = 20; // 10 detik maks
    
    const interval = setInterval(() => {
        attempts++;
        if (processNuxtData()) {
            clearInterval(interval); // Stop jika sukses
        } else if (attempts >= maxAttempts) {
            console.error("[BMKG-Receiptor] Gagal menemukan data valid setelah 10 detik.");
            clearInterval(interval);
        }
    }, 500);

})();