// content.js - Bridge between Extension Popup and Injected Script

function injectScript() {

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/inject.js');
    script.onload = () => {

        script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

// Listen for messages from the Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'CALL_AI_VIA_INJECTION') {
        window.postMessage({
            type: 'FROM_CONTENT_SCRIPT',
            action: 'CALL_AI',
            payload: { prompt: message.prompt }
        }, '*');
        return true; 
    }
});

// Listen for response from injected script
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.type !== 'FROM_PAGE_CONTEXT') {
        return;
    }


    if (event.data.action === 'AI_RESPONSE') {
        chrome.runtime.sendMessage({
            type: 'AI_RESPONSE_FROM_PAGE',
            payload: event.data.payload,
            error: event.data.error
        });
    }
});

injectScript();
