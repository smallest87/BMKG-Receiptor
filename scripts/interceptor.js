(function() {
    console.log("%c[BMKG-Receiptor] Mode: URL-Based Logic Active", "color: lime; font-weight: bold; font-size: 14px;");

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

    // --- 3. URL BASED NAMING LOGIC (INTI PERUBAHAN) ---
    function generateFileNameFromURL(data) {
        // Ambil kode wilayah dari URL terakhir (misal: 35.07.09.2005)
        const pathSegments = window.location.pathname.replace(/\/$/, '').split('/');
        const regionCode = pathSegments[pathSegments.length - 1]; 
        
        // Hitung jumlah segmen kode berdasarkan pemisah titik (.)
        // Contoh: "35.07.09.2005" -> split('.') -> length 4
        const codeLevel = regionCode.includes('.') ? regionCode.split('.').length : 1;

        const dateStr = new Date().toISOString().split('T')[0];
        
        // Ambil sampel administrasi dari data pertama untuk mendapatkan Nama Wilayah
        const adm = data[0]?.administrasi || {};
        let prefix = "BMKG";
        let regionName = "Data";

        // LOGIKA HIERARKI SESUAI REQUEST
        switch (codeLevel) {
            case 4: // Format: 35.07.09.2005 (Desa)
                prefix = "Hourly_Desa";
                // Ambil nama desa dan kecamatan
                regionName = `${adm.desa || 'Desa'}_${adm.kecamatan || ''}`;
                break;

            case 3: // Format: 35.07.09 (Kecamatan)
                prefix = "Daily_Kecamatan";
                regionName = `${adm.kecamatan || 'Kecamatan'}_${adm.kotkab || ''}`;
                break;

            case 2: // Format: 35.07 (Kota/Kab)
                prefix = "Daily_Kabupaten";
                regionName = `${adm.kotkab || 'Kabupaten'}`;
                break;

            case 1: // Format: 35 (Provinsi)
                prefix = "Daily_Provinsi";
                regionName = `${adm.provinsi || 'Provinsi'}`;
                break;
            
            default:
                // Fallback jika URL tidak standar
                prefix = "BMKG_Data";
                regionName = regionCode;
        }

        // Bersihkan nama file
        const safeRegion = regionName.trim()
            .replace("Kota ", "") // Hapus prefix standar
            .replace("Kab. ", "")
            .replace(/[^a-zA-Z0-9_]/g, "_") // Ganti karakter aneh dengan _
            .replace(/_+/g, "_"); // Hapus _ ganda

        return `BMKG_${prefix}_${safeRegion}_${dateStr}.json`;
    }

    // --- 4. MAIN EXECUTOR ---
    function executeExtraction() {
        const scriptTag = document.getElementById('__NUXT_DATA__');
        if (!scriptTag) return false;

        try {
            const rawData = JSON.parse(scriptTag.textContent);
            let finalResult = null;

            // STRATEGI EKSTRAKSI UNIVERSAL
            // Cari array yang berisi object dengan 'lokasi' dan 'cuaca'
            const targetList = rawData.find(item => 
                Array.isArray(item) && item.length > 0 && typeof item[0] === 'number' && 
                rawData[item[0]] && typeof rawData[item[0]] === 'object' &&
                'lokasi' in rawData[item[0]] && 'cuaca' in rawData[item[0]]
            );

            let decodedList = [];
            
            if (targetList) {
                // Kasus Multi (Kecamatan/Kota/Provinsi)
                decodedList = unflatten(rawData, rawData.indexOf(targetList));
            } else {
                // Kasus Single (Desa - Detail)
                // Cari object tunggal yang punya 'lokasi' dan 'cuaca' (biasanya ada di root array)
                const singleObjIndex = rawData.findIndex(item => 
                    item && typeof item === 'object' && !Array.isArray(item) &&
                    'lokasi' in item && 'cuaca' in item
                );
                if (singleObjIndex !== -1) {
                    decodedList = [unflatten(rawData, singleObjIndex)];
                }
            }

            if (decodedList.length > 0) {
                // Format ulang data agar konsisten
                finalResult = decodedList.map(area => ({
                    wilayah: area.lokasi?.desa || area.lokasi?.nama || area.lokasi?.kecamatan || 'Unknown',
                    administrasi: area.lokasi,
                    prakiraan: Array.isArray(area.cuaca) ? area.cuaca.map(cleanWeatherData) : []
                }));

                // Generate Nama File Berbasis URL
                const fileName = generateFileNameFromURL(finalResult);

                console.clear();
                console.group(`%c[BMKG-Receiptor] SUKSES ✅`, "background: #004400; color: #00ff00; padding: 4px; font-size: 16px;");
                console.log("🔗 URL Context:", window.location.pathname);
                console.log("📄 Target Filename:", fileName);
                console.table(finalResult[0].prakiraan.slice(0, 5));
                console.groupEnd();

                // DOWNLOAD
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
            }

        } catch (e) {
            console.error("[BMKG-Receiptor] Error:", e);
        }
        return false;
    }

    // POLLING
    let attempts = 0;
    const poller = setInterval(() => {
        attempts++;
        if (executeExtraction() || attempts > 20) {
            clearInterval(poller);
        }
    }, 600);

})();