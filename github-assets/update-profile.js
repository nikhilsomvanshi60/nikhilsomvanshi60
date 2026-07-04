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
