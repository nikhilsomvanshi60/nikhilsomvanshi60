/**
 * NIK AI TECHNOLOGY // NIK Profile Automated Updater Script
 * Runs in GitHub Actions, parses and updates README.md with live telemetry.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// Configuration
// Dynamic extraction of username based on the repository owner
const repoOwner = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[0] : 'nikhilsomvanshi60';
const README_PATH = path.join(__dirname, '../README.md');

const FALLBACK_QUOTES = [
    "Nik, sometimes you gotta run before you can walk.",
    "Designing smart prompts is like directing the thoughts of tomorrow.",
    "The best way to predict the future is to automate it.",
    "Technological progress is only real if it serves everyone.",
    "Prompt engineering is the compiler of the cognitive age.",
    "An AI is only as good as the system architecture behind it."
];

// Helper: HTTP GET request
function fetchURL(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Nik-Profile-Updater',
                ...headers
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`Request failed status: ${res.statusCode}`));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function getLatestRepos(username) {
    try {
        const token = process.env.GITHUB_TOKEN;
        const headers = token ? { 'Authorization': `token ${token}` } : {};
        const url = `https://api.github.com/users/${username}/repos?sort=pushed&per_page=5`;
        
        console.log(`Fetching latest repos for user: ${username}...`);
        const responseData = await fetchURL(url, headers);
        const repos = JSON.parse(responseData);
        
        return repos.map(repo => ({
            name: repo.name,
            url: repo.html_url,
            description: repo.description || "No description provided.",
            language: repo.language || "Markdown"
        }));
    } catch (error) {
        console.error("Error fetching repositories:", error.message);
        return [];
    }
}

async function getDailyQuote() {
    try {
        // Try programming joke or quote
        const responseData = await fetchURL("https://v2.jokeapi.dev/joke/Programming?type=single");
        const jokeObj = JSON.parse(responseData);
        if (jokeObj && jokeObj.joke) {
            return `"${jokeObj.joke}"`;
        }
    } catch (e) {
        console.log("Using local NIK Database quotes due to external API latency.");
    }
    
    // Pick a random fallback quote
    const index = Math.floor(Math.random() * FALLBACK_QUOTES.length);
    return `"${FALLBACK_QUOTES[index]}" — NIK AI Database`;
}

function updatePlaceholder(content, startMarker, endMarker, replacement) {
    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker);
    
    if (startIdx === -1 || endIdx === -1) {
        console.warn(`Markers not found: ${startMarker} or ${endMarker}`);
        return content;
    }
    
    const before = content.slice(0, startIdx + startMarker.length);
    const after = content.slice(endIdx);
    
    return `${before}\n${replacement}\n${after}`;
}

function buildGrowthLog(repos) {
    const pythonCount = repos.filter(r => (r.language || '').toLowerCase() === 'python').length;
    const jsCount = repos.filter(r => (r.language || '').toLowerCase() === 'javascript').length;
    
    const aiKeywords = ['companion', 'agent', 'ai', 'llm', 'prompt', 'gpt', 'gemini'];
    const aiCount = repos.filter(r => 
        aiKeywords.some(kw => (r.name || '').toLowerCase().includes(kw)) ||
        aiKeywords.some(kw => (r.description || '').toLowerCase().includes(kw))
    ).length;

    const securityKeywords = ['security', 'cyber', 'pentest', 'hack', 'report', 'exploit', 'defense'];
    const securityCount = repos.filter(r => 
        securityKeywords.some(kw => (r.name || '').toLowerCase().includes(kw)) ||
        securityKeywords.some(kw => (r.description || '').toLowerCase().includes(kw))
    ).length;

    // Base values + repository count influence
    // Fluctuations are +/- 1.5% to simulate live activity
    const fluctuate = () => Math.round((Math.random() * 3 - 1.5) * 10) / 10;
    
    const skills = [
        { label: "Prompt Engineering",     base: 94, weight: 1.5, multiplier: aiCount,       emoji: "🔮" },
        { label: "AI Agent Development",   base: 82, weight: 1.2, multiplier: aiCount,       emoji: "🤖" },
        { label: "Security Automation",    base: 81, weight: 1.5, multiplier: securityCount, emoji: "⚡" },
        { label: "New Skills — Daily",     base: 86, weight: 0.8, multiplier: repos.length,  emoji: "📚" },
        { label: "Cybersecurity Research", base: 72, weight: 2.0, multiplier: securityCount, emoji: "🛡️" },
        { label: "LLM Fine-Tuning",        base: 78, weight: 1.5, multiplier: aiCount,       emoji: "🧠" }
    ];

    const lines = [
        "```",
        "  ╔════════════════════════════════════════════════════════════════════════╗",
        "  ║              ✦   N I K   G R O W T H   L O G   ✦                      ║",
        "  ╠═══════════════════════════╦════════════════════════════════════════════╣"
    ];

    skills.forEach(skill => {
        let percentage = Math.round(skill.base + (skill.weight * skill.multiplier) + fluctuate());
        if (percentage > 98) percentage = 98;
        if (percentage < 50) percentage = 50;

        const barLength = 15;
        const filledCount = Math.round((percentage / 100) * barLength);
        const emptyCount = barLength - filledCount;
        const bar = '▰'.repeat(filledCount) + '▱'.repeat(emptyCount);

        const paddedLabel = skill.label.padEnd(25, ' ');
        const pctStr = `${percentage}%`.padStart(3, ' ');
        
        // Construct the right column content with exactly 18 spaces of trailing padding
        // This ensures pixel-perfect visual alignment in Markdown renderers
        const paddedRight = `  ${bar}  ${pctStr}  ${skill.emoji}                  `;

        lines.push(`  ║  ${paddedLabel}║${paddedRight}║`);
    });

    lines.push("  ╚═══════════════════════════╩════════════════════════════════════════════╝");
    lines.push("```");
    return lines.join('\n');
}

async function run() {
    try {
        if (!fs.existsSync(README_PATH)) {
            console.error(`README not found at ${README_PATH}. Initializing dummy template...`);
            fs.writeFileSync(README_PATH, `# Profile\n<!-- LATEST_REPOS_START -->\n<!-- LATEST_REPOS_END -->\n<!-- QUOTE_START -->\n<!-- QUOTE_END -->`);
        }

        let readmeContent = fs.readFileSync(README_PATH, 'utf8');

        // 1. Fetch data
        const repos = await getLatestRepos(repoOwner);
        const quote = await getDailyQuote();

        // 2. Build Repository Markdown Section
        let reposMarkdown = "";
        if (repos.length > 0) {
            repos.slice(0, 4).forEach(repo => {
                reposMarkdown += `- [**${repo.name}**](${repo.url}) - ${repo.description} (\`${repo.language}\`)\n`;
            });
        } else {
            reposMarkdown = "_No recent updates found._";
        }

        // 3. Build Quote Section
        const quoteMarkdown = `> *${quote}*`;

        // 4. Update Placeholders
        let updatedContent = updatePlaceholder(
            readmeContent, 
            "<!-- LATEST_REPOS_START -->", 
            "<!-- LATEST_REPOS_END -->", 
            reposMarkdown
        );
        
        updatedContent = updatePlaceholder(
            updatedContent, 
            "<!-- QUOTE_START -->", 
            "<!-- QUOTE_END -->", 
            quoteMarkdown
        );

        // Build and update Growth Log
        const growthLogMarkdown = buildGrowthLog(repos);
        updatedContent = updatePlaceholder(
            updatedContent,
            "<!-- NIK_GROWTH_LOG_START -->",
            "<!-- NIK_GROWTH_LOG_END -->",
            growthLogMarkdown
        );

        // Update timestamps/logs inside the file
        const updateTimeMarker = "<!-- LAST_SYSTEM_SYNC_START -->";
        const updateTimeEndMarker = "<!-- LAST_SYSTEM_SYNC_END -->";
        const currentTimeString = `_${new Date().toUTCString()}_`;
        updatedContent = updatePlaceholder(
            updatedContent,
            updateTimeMarker,
            updateTimeEndMarker,
            currentTimeString
        );

        fs.writeFileSync(README_PATH, updatedContent, 'utf8');
        console.log("Nik Sync Protocol completed successfully!");

    } catch (error) {
        console.error("Critical failure in Nik Sync Execution:", error);
        process.exit(1);
    }
}

run();
