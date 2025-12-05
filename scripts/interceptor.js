(function() {
    console.log("%c[BMKG-Receiptor] Mode: Universal Deep Decoder", "color: lime; font-weight: bold; font-size: 14px;");

    // --- ENGINE: DEEP NUXT DECODER ---
    // Fungsi ini merekonstruksi data yang 'gepeng' (flat) menjadi object utuh (nested)
    function unflatten(source, index) {
        // Jika index bukan angka, berarti itu nilai literal (string/bool/null)
        if (typeof index !== 'number') return index;
        
        // Safety check index out of bound
        if (index >= source.length || index < 0) return null;

        const item = source[index];

        // Jika item adalah Array, rekursif untuk setiap elemennya
        if (Array.isArray(item)) {
            return item.map(i => unflatten(source, i));
        }

        // Jika item adalah Object, rekursif untuk setiap key-nya
        if (item && typeof item === 'object') {
            const result = {};
            for (const key in item) {
                // Nuxt menyimpan key sebagai string biasa, tapi value-nya bisa berupa index
                result[key] = unflatten(source, item[key]);
            }
            return result;
        }

        // Jika item primitive (string/number langsung di array induk)
        return item;
    }

    // --- FORMATTER ---
    // Membersihkan data hasil decode agar enak dibaca
    function cleanWeatherData(item) {
        // Mapping key yang aneh menjadi manusiawi
        const map = {
            't': 'suhu', 'tmin': 'suhu_min', 'tmax': 'suhu_max',
            'hu': 'kelembapan', 'humin': 'kelembapan_min', 'humax': 'kelembapan_max',
            'ws': 'kecepatan_angin', 'wd': 'arah_angin',
            'weather_desc': 'kondisi', 'weather_desc_en': 'kondisi_en',
            'local_datetime': 'waktu_lokal', 'datetime': 'waktu_utc',
            'vs_text': 'jarak_pandang'
        };

        const clean = {};
        for (const key in item) {
            if (map[key]) {
                clean[map[key]] = item[key];
            } else if (['image', 'analysis_date', 'time_index'].includes(key)) {
                // Skip field sampah
                continue;
            } else {
                // Keep field lain
                clean[key] = item[key];
            }
        }
        return clean;
    }

    function executeExtraction() {
        const scriptTag = document.getElementById('__NUXT_DATA__');
        if (!scriptTag) return false;

        try {
            const rawData = JSON.parse(scriptTag.textContent);
            console.log(`[BMKG-Receiptor] Raw Data Size: ${rawData.length} nodes.`);

            let finalResult = null;
            let extractionType = "";

            // --- STRATEGY 1: MULTI-LOCATION (Kecamatan/Provinsi) ---
            // Mencari array yang isinya object dengan properti 'lokasi' DAN 'cuaca'
            const multiLocList = rawData.find(item => 
                Array.isArray(item) && 
                item.length > 0 && 
                typeof item[0] === 'number' && // Isinya pointer
                rawData[item[0]] && 
                typeof rawData[item[0]] === 'object' &&
                'lokasi' in rawData[item[0]] && 
                'cuaca' in rawData[item[0]]
            );

            if (multiLocList) {
                extractionType = "MULTI_LOCATION (Kecamatan)";
                // Decode seluruh list
                const decodedList = unflatten(rawData, rawData.indexOf(multiLocList));
                
                // Rapikan hasil
                finalResult = decodedList.map(area => ({
                    wilayah: area.lokasi?.desa || area.lokasi?.nama || 'Unknown',
                    administrasi: area.lokasi,
                    prakiraan: Array.isArray(area.cuaca) ? area.cuaca.map(cleanWeatherData) : []
                }));
            }

            // --- STRATEGY 2: SINGLE-LOCATION (Desa/Detail) ---
            // Jika Strategy 1 gagal, cari pola single object cuaca
            if (!finalResult) {
                // Cari object di root yang punya 'lokasi' dan 'cuaca' tapi bukan array
                const singleObjIndex = rawData.findIndex(item => 
                    item && typeof item === 'object' && !Array.isArray(item) &&
                    'lokasi' in item && 'cuaca' in item
                );

                if (singleObjIndex !== -1) {
                    extractionType = "SINGLE_LOCATION (Desa)";
                    const decodedObj = unflatten(rawData, singleObjIndex);
                    
                    // Normalisasi struktur agar sama dengan multi
                    const weatherArray = Array.isArray(decodedObj.cuaca) ? decodedObj.cuaca : [decodedObj.cuaca];
                    
                    finalResult = [{
                        wilayah: decodedObj.lokasi?.desa || 'Unknown',
                        administrasi: decodedObj.lokasi,
                        prakiraan: weatherArray.map(cleanWeatherData)
                    }];
                }
            }

            if (finalResult) {
                console.clear();
                console.group(`%c[BMKG-Receiptor] 🟢 SUCCESS: ${extractionType}`, "background: #004400; color: #00ff00; padding: 4px; font-size: 14px;");
                console.log(`Berhasil mengambil data untuk ${finalResult.length} wilayah.`);
                
                // Preview Data Pertama
                if(finalResult[0]) {
                    console.log("Contoh Wilayah Pertama:", finalResult[0].wilayah);
                    console.table(finalResult[0].prakiraan);
                }
                
                console.groupEnd();

                // DOWNLOAD JSON
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const jsonString = JSON.stringify(finalResult, null, 2);
                const blob = new Blob([jsonString], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `BMKG_${extractionType.split(' ')[0]}_${timestamp}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                return true;
            }

        } catch (e) {
            console.error("[BMKG-Receiptor] Critical Error:", e);
        }
        return false;
    }

    // Polling Mechanism
    let attempts = 0;
    const poller = setInterval(() => {
        attempts++;
        if (executeExtraction() || attempts > 10) {
            clearInterval(poller);
            if (attempts > 10) console.warn("[BMKG-Receiptor] Timeout: Pattern not found.");
        }
    }, 800);

})();