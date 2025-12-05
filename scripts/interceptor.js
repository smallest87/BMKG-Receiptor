(function() {
    console.log("%c[BMKG-Receiptor] Mode: All-Level Coverage + Manual Trigger", "color: lime; font-weight: bold; font-size: 14px;");

    // --- 1. ENGINE: DEEP NUXT DECODER ---
    function resolve(source, index) {
        if (typeof index === 'number' && index < source.length && index >= 0) {
            return source[index];
        }
        return index;
    }

    function unflatten(source, index) {
        const item = resolve(source, index);
        if (Array.isArray(item)) {
            return item.map(i => unflatten(source, i));
        } else if (item && typeof item === 'object') {
            const result = {};
            for (const key in item) {
                result[key] = unflatten(source, item[key]);
            }
            return result;
        }
        return item;
    }

    // --- 2. FORMATTER ---
    function cleanWeatherData(item) {
        const map = {
            't': 'suhu', 'tmin': 'suhu_min', 'tmax': 'suhu_max',
            'hu': 'kelembapan', 'humin': 'kelembapan_min', 'humax': 'kelembapan_max',
            'ws': 'kecepatan_angin', 'wd': 'arah_angin', 'wd_deg': 'arah_angin_derajat',
            'weather_desc': 'kondisi', 'weather_desc_en': 'kondisi_en',
            'local_datetime': 'waktu_lokal', 'datetime': 'waktu_utc', 'utc_datetime': 'waktu_utc',
            'vs_text': 'jarak_pandang'
        };
        const clean = {};
        for (const key in item) {
            if (map[key]) clean[map[key]] = item[key];
            else if (!['image', 'analysis_date', 'time_index'].includes(key)) clean[key] = item[key];
        }
        return clean;
    }

    // --- 3. URL BASED NAMING ---
    function generateFileNameFromURL(data) {
        const pathSegments = window.location.pathname.replace(/\/$/, '').split('/');
        const regionCode = pathSegments[pathSegments.length - 1]; 
        const codeLevel = regionCode.includes('.') ? regionCode.split('.').length : 1;
        const dateStr = new Date().toISOString().split('T')[0];
        const adm = data[0]?.administrasi || {};
        
        let prefix = "BMKG";
        let regionName = "Data";

        switch (codeLevel) {
            case 4: // Desa
                prefix = "Hourly_Desa";
                regionName = `${adm.desa || 'Desa'}_${adm.kecamatan || ''}`;
                break;
            case 3: // Kecamatan
                prefix = "Daily_Kecamatan";
                regionName = `${adm.kecamatan || 'Kecamatan'}_${adm.kotkab || ''}`;
                break;
            case 2: // Kabupaten/Kota
                prefix = "Daily_Kabupaten";
                regionName = `${adm.kotkab || 'Kabupaten'}`;
                break;
            case 1: // Provinsi
                prefix = "Daily_Provinsi";
                regionName = `${adm.provinsi || 'Provinsi'}`;
                break;
            default:
                regionName = regionCode;
        }

        const safeRegion = regionName.trim()
            .replace("Kota ", "") 
            .replace("Kab. ", "")
            .replace(/[^a-zA-Z0-9_]/g, "_") 
            .replace(/_+/g, "_"); 

        return `BMKG_${prefix}_${safeRegion}_${dateStr}.json`;
    }

    // --- 4. MAIN EXECUTOR ---
    // Parameter 'isManual' ditambahkan untuk logic logging/alert
    function executeExtraction(isManual = false) {
        const scriptTag = document.getElementById('__NUXT_DATA__');
        if (!scriptTag) {
            if (isManual) alert("❌ Elemen __NUXT_DATA__ tidak ditemukan!");
            return false;
        }

        try {
            const rawData = JSON.parse(scriptTag.textContent);
            let finalResult = null;

            const targetList = rawData.find(item => 
                Array.isArray(item) && item.length > 0 && typeof item[0] === 'number' && 
                rawData[item[0]] && typeof rawData[item[0]] === 'object' &&
                'lokasi' in rawData[item[0]] && 'cuaca' in rawData[item[0]]
            );

            let decodedList = [];
            
            if (targetList) {
                decodedList = unflatten(rawData, rawData.indexOf(targetList));
            } else {
                const singleObjIndex = rawData.findIndex(item => 
                    item && typeof item === 'object' && !Array.isArray(item) &&
                    'lokasi' in item && 'cuaca' in item
                );
                if (singleObjIndex !== -1) {
                    decodedList = [unflatten(rawData, singleObjIndex)];
                }
            }

            if (decodedList.length > 0) {
                finalResult = decodedList.map(area => ({
                    wilayah: area.lokasi?.desa || 
                             area.lokasi?.kecamatan || 
                             area.lokasi?.kotkab || 
                             area.lokasi?.provinsi || 
                             area.lokasi?.nama || 
                             'Unknown',
                    administrasi: area.lokasi,
                    prakiraan: Array.isArray(area.cuaca) ? area.cuaca.map(cleanWeatherData) : []
                }));

                const fileName = generateFileNameFromURL(finalResult);

                console.clear();
                console.group(`%c[BMKG-Receiptor] 🟢 DATA CAPTURED ${isManual ? '(MANUAL)' : '(AUTO)'}`, "background: #004400; color: #00ff00; padding: 4px; font-size: 16px;");
                console.log("📄 Filename:", fileName);
                console.table(finalResult[0].prakiraan.slice(0, 3));
                console.groupEnd();

                // DOWNLOAD logic
                const jsonString = JSON.stringify(finalResult, null, 2);
                const blob = new Blob([jsonString], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                return true;
            } else {
                if (isManual) alert("❌ Struktur data cuaca tidak dikenali di halaman ini.");
            }

        } catch (e) {
            console.error("[BMKG-Receiptor] Error:", e);
            if (isManual) alert("❌ Terjadi error saat parsing data: " + e.message);
        }
        return false;
    }

    // --- 5. EXPOSE TO WINDOW (Agar bisa dipanggil Background.js) ---
    window.forceBmkgScrape = executeExtraction;

    // --- 6. AUTO POLLING (Tetap berjalan) ---
    let attempts = 0;
    const poller = setInterval(() => {
        attempts++;
        // Auto run tidak menampilkan alert error (isManual = false)
        if (executeExtraction(false) || attempts > 20) {
            clearInterval(poller);
        }
    }, 600);

})();