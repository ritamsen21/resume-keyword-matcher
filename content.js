// content.js
(() => {
    // Safely get visible page text
    function getPageText() {
        // Limit size to avoid huge payloads
        try {
            return document.body ? document.body.innerText || "" : "";
        } catch (e) {
            return "";
        }
    }

    // Escape for RegExp
    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // Highlight keywords (simple implementation using text node replacement)
    function highlightKeywords(keywords) {
        if (!keywords || !keywords.length) return { ok: false, reason: "no keywords" };

        const regex = new RegExp("\\b(" + keywords.map(k => escapeRegExp(k)).join("|") + ")\\b", "gi");

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                // ignore script/style and inside certain tags
                if (!node.parentNode) return NodeFilter.FILTER_REJECT;
                const pname = node.parentNode.nodeName;
                if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(pname)) return NodeFilter.FILTER_REJECT;
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        let replacedCount = 0;
        nodes.forEach(textNode => {
            const text = textNode.nodeValue;
            if (regex.test(text)) {
                // Create a span and set innerHTML with replacements
                const span = document.createElement("span");
                span.innerHTML = text.replace(regex, match => `<mark style="background: #ffea8a; color: #000; padding:0 2px; border-radius:2px;">${match}</mark>`);
                textNode.parentNode.replaceChild(span, textNode);
                replacedCount++;
            }
        });

        return { ok: true, replaced: replacedCount };
    }

    // Message listener for popup
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg && msg.type === "GET_JOB_TEXT") {
            sendResponse({ text: getPageText() });
        } else if (msg && msg.type === "HIGHLIGHT_KEYWORDS") {
            const keywords = Array.isArray(msg.keywords) ? msg.keywords.slice(0, 200) : [];
            const res = highlightKeywords(keywords);
            sendResponse({ result: res });
        }
        // indicate async response if needed
        return true;
    });
})();
