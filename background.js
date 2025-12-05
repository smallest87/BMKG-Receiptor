// Listener saat Ekstensi diinstall atau direload
chrome.runtime.onInstalled.addListener(() => {
    console.log("BMKG-Receiptor Service Worker: READY.");
});

// Listener untuk memantau Header Request sebelum dikirim
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Filter hanya request yang mengarah ke API/Data (bukan gambar/css)
        if (details.type === "xmlhttprequest" || details.type === "fetch") {
            console.group(`%c[HEADER-OUT] ${details.method}: ${details.url}`, "color: #00ff00");
            
            details.requestHeaders.forEach(header => {
                console.log(`${header.name}: ${header.value}`);
            });
            
            console.groupEnd();
        }
    },
    { urls: ["*://*.bmkg.go.id/*"] },
    ["requestHeaders"]
);

// Listener untuk memantau Status Code Response
chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.type === "xmlhttprequest" || details.type === "fetch") {
             // Log error jika status bukan 200 OK
            if (details.statusCode >= 400) {
                console.warn(`[ERROR ${details.statusCode}] ${details.url}`);
            }
        }
    },
    { urls: ["*://*.bmkg.go.id/*"] }
);