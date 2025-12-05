(function() {
    console.log("%c[BMKG-Receiptor] Target: Desa Gedogkulon Locked.", "color: lime; font-weight: bold; font-size: 14px;");

    // Helper untuk membaca XML string
    function parseXML(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");
            return xmlDoc;
        } catch (e) {
            return null;
        }
    }

    // 1. Intercept Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [resource, config] = args;
        const response = await originalFetch(resource, config);
        
        const clone = response.clone();
        clone.text().then(body => {
            // Cek apakah JSON
            try {
                const data = JSON.parse(body);
                console.groupCollapsed(`%c[FETCH-JSON] ${resource}`, "color: cyan");
                console.log(data);
                console.groupEnd();
                return;
            } catch (e) {}

            // Cek apakah XML (Data BMKG seringkali XML)
            if (body.includes("<?xml") || body.includes("<data source=")) {
                console.groupCollapsed(`%c[FETCH-XML] ${resource}`, "color: magenta");
                console.log("Raw String:", body.substring(0, 200) + "..."); // Print dikit aja
                console.log("Parsed XML:", parseXML(body));
                console.groupEnd();
            }
        });
        return response;
    };

    // 2. Intercept XHR (Paling mungkin dipakai di halaman ini)
    const XHR = XMLHttpRequest.prototype;
    const send = XHR.send;
    
    XHR.send = function(postData) {
        this.addEventListener('load', function() {
            const url = this.responseURL || this._url;
            
            // Filter URL sampah (Google Analytics, tracking, font, gambar)
            if (!url || url.includes('google') || url.includes('.png') || url.includes('.woff')) return;

            console.groupCollapsed(`%c[XHR] ${url}`, "color: orange");
            
            // Coba Parse JSON
            try {
                const json = JSON.parse(this.responseText);
                console.log("JSON Data:", json);
            } catch (e) {
                // Jika bukan JSON, coba XML
                if (this.responseText.includes("<data") || this.responseText.includes("<?xml")) {
                    console.log("XML Data Detected!");
                    console.log(parseXML(this.responseText));
                } else {
                    console.log("Response (Text):", this.responseText.substring(0, 100) + "...");
                }
            }
            console.groupEnd();
        });
        return send.apply(this, arguments);
    };
})();