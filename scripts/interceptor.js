(function() {
    console.log("%c[BMKG-Receiptor] Active & Monitoring...", "color: lime; font-weight: bold; font-size: 14px;");

    // 1. Intercept Fetch API (Modern Requests)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [resource, config] = args;
        
        // Lakukan request asli
        const response = await originalFetch(resource, config);
        
        // Clone response agar bisa dibaca dua kali (oleh browser & oleh kita)
        const clone = response.clone();
        
        clone.text().then(body => {
            try {
                // Coba parsing ke JSON untuk melihat struktur data
                const jsonData = JSON.parse(body);
                console.groupCollapsed(`%c[FETCH] Captured: ${resource}`, "color: cyan");
                console.log("URL:", resource);
                console.log("Data:", jsonData);
                console.groupEnd();
            } catch (e) {
                // Abaikan jika bukan JSON (gambar/css/html)
            }
        });

        return response;
    };

    // 2. Intercept XHR (Legacy Requests - jQuery biasanya pakai ini)
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function(method, url) {
        this._method = method;
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function(postData) {
        this.addEventListener('load', function() {
            if (this.responseType === '' || this.responseType === 'text') {
                try {
                    const jsonData = JSON.parse(this.responseText);
                    console.groupCollapsed(`%c[XHR] Captured: ${this._url}`, "color: orange");
                    console.log("URL:", this._url);
                    console.log("Payload:", jsonData);
                    console.groupEnd();
                } catch (e) {
                    // Abaikan non-JSON
                }
            }
        });
        return send.apply(this, arguments);
    };
})();