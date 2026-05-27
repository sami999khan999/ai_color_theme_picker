// inject.js - Runs in the page's execution context to access window.ai
(async function() {

    
    window.addEventListener('message', async (event) => {
        if (event.source !== window || !event.data || event.data.type !== 'FROM_CONTENT_SCRIPT') {
            return;
        }

        const { action, payload } = event.data;


        if (action === 'CALL_AI') {
            try {
                if (!window.ai) {
                    throw new Error('window.ai is entirely missing from this page window.');
                }
                
                const lModel = window.ai.languageModel || window.ai.createTextSession;
                if (!lModel) {
                    throw new Error('window.ai detected but languageModel/createTextSession is missing.');
                }


                const model = await (window.ai.languageModel ? window.ai.languageModel.create({
                    systemPrompt: "You are a Shadcn UI theme expert. Output ONLY raw CSS for :root and .dark modes using OKLCH colors. Do not explain. Do not use code blocks."
                }) : window.ai.createTextSession());


                const response = await model.prompt(payload.prompt);

                
                window.postMessage({ 
                    type: 'FROM_PAGE_CONTEXT', 
                    action: 'AI_RESPONSE', 
                    payload: { text: response } 
                }, '*');

            } catch (error) {
                console.error('Color Theme Picker (Page) AI Error:', error);
                window.postMessage({ 
                    type: 'FROM_PAGE_CONTEXT', 
                    action: 'AI_RESPONSE', 
                    error: error.message 
                }, '*');
            }
        }
    });
})();
