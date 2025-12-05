// background.js

// 1. Setup saat Instalasi/Update
chrome.runtime.onInstalled.addListener(() => {
    // Buat Context Menu
    chrome.contextMenus.create({
        id: "force-scrape",
        title: "⚡ Force Scrape Weather Data",
        contexts: ["all"]
    });
});

// 2. Handle Klik Menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "force-scrape") {
        // Kita eksekusi script langsung ke "MAIN" world di tab target
        // Ini akan memanggil fungsi global yang kita expose di interceptor.js
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: () => {
                if (typeof window.forceBmkgScrape === 'function') {
                    console.log("[Background] Triggering manual scrape...");
                    window.forceBmkgScrape(true); // true = manual mode
                } else {
                    alert("BMKG-Receiptor belum siap atau tidak aktif di halaman ini.");
                }
            }
        });
    }
});