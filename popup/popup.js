// popup/popup.js

// --- small tokenizer & keyword extractor ---
const STOPWORDS = new Set([
    "the", "a", "an", "and", "or", "of", "in", "for", "to", "with", "on", "is", "are", "as", "by", "from", "that", "this", "be",
    "you", "your", "we", "i", "it", "at", "will", "can", "have", "has", "but", "if", "which", "their", "they", "them", "our"
]);

function tokenize(text) {
    return (text || "")
        .toLowerCase()
        .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
        .replace(/[^a-z0-9\-\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

function getKeywords(text, { minLength = 2 } = {}) {
    const words = tokenize(text);
    const freq = Object.create(null);
    for (const w of words) {
        if (STOPWORDS.has(w)) continue;
        if (w.length < minLength) continue;
        freq[w] = (freq[w] || 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

// --- helper to get job page text from content script ---
function getJobTextFromActiveTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab) return resolve("");
            chrome.tabs.sendMessage(tab.id, { type: "GET_JOB_TEXT" }, (response) => {
                resolve(response?.text || "");
            });
        });
    });
}

// --- UI handlers ---
document.getElementById("pasteResume").addEventListener("click", async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    document.getElementById("resumeText").value = text;
});

document.getElementById("loadFromFile").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md";
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            document.getElementById("resumeText").value = reader.result;
        };
        reader.readAsText(file);
    };
    input.click();
});

document.getElementById("checkMatch").addEventListener("click", async () => {
    const resume = document.getElementById("resumeText").value || "";
    const jobText = await getJobTextFromActiveTab();
    const resumeKeys = new Set(getKeywords(resume));
    const jobKeys = getKeywords(jobText);
    if (jobKeys.length === 0) {
        document.getElementById("result").innerText = "No keywords found on this page. Try on a job listing page.";
        return;
    }
    const matched = jobKeys.filter(k => resumeKeys.has(k));
    const missing = jobKeys.filter(k => !resumeKeys.has(k));
    const score = Math.round((matched.length / jobKeys.length) * 100);
    document.getElementById("result").innerHTML =
        `Match score: ${score}%\n\nTop matched (${matched.length}): ${matched.slice(0, 10).join(", ") || "—"}\n\nTop missing: ${missing.slice(0, 20).join(", ") || "—"}`;
});

document.getElementById("highlightBtn").addEventListener("click", async () => {
    const resume = document.getElementById("resumeText").value || "";
    const jobText = await getJobTextFromActiveTab();
    const resumeKeys = new Set(getKeywords(resume));
    const jobKeys = getKeywords(jobText);
    const missing = jobKeys.filter(k => !resumeKeys.has(k)).slice(0, 200);
    if (!missing.length) {
        document.getElementById("result").innerText = "No missing keywords to highlight (your resume already contains the detected job keywords).";
        return;
    }

    // send highlight request to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab) {
            document.getElementById("result").innerText = "No active tab found.";
            return;
        }
        chrome.tabs.sendMessage(tab.id, { type: "HIGHLIGHT_KEYWORDS", keywords: missing }, (resp) => {
            document.getElementById("result").innerText = `Highlighted ${missing.length} missing keywords on the page (approx).`;
        });
    });
});
