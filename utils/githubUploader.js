
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username';
const GITHUB_REPO = process.env.GITHUB_REPO || 'uploads-storage';

if (!GITHUB_TOKEN || GITHUB_USERNAME === 'your-username') {
    console.warn('WARNING: GITHUB_TOKEN or GITHUB_USERNAME not set. GitHub upload will not work.');
}

async function uploadToGitHub(localFilePath, githubPath) {
    if (!GITHUB_TOKEN || GITHUB_USERNAME === 'your-username') {
        console.error('GitHub credentials not configured. Skipping upload.');
        return null;
    }

    try {
        const fileContent = fs.readFileSync(localFilePath);
        const base64Content = fileContent.toString('base64');
        
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${githubPath}`;
        
        let sha = null;
        try {
            const existingFile = await axios.get(url, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            sha = existingFile.data.sha;
        } catch (err) {
        }

        const payload = {
            message: `Upload ${path.basename(githubPath)}`,
            content: base64Content,
            branch: 'main'
        };

        if (sha) {
            payload.sha = sha;
        }

        const response = await axios.put(url, payload, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        return response.data.content.download_url;
    } catch (error) {
        console.error('GitHub upload error:', error.response?.data || error.message);
        return null;
    }
}

async function deleteFromGitHub(githubPath) {
    if (!GITHUB_TOKEN || GITHUB_USERNAME === 'your-username') {
        return false;
    }

    try {
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${githubPath}`;
        
        const existingFile = await axios.get(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        await axios.delete(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            data: {
                message: `Delete ${path.basename(githubPath)}`,
                sha: existingFile.data.sha,
                branch: 'main'
            }
        });

        return true;
    } catch (error) {
        console.error('GitHub delete error:', error.response?.data || error.message);
        return false;
    }
}

module.exports = {
    uploadToGitHub,
    deleteFromGitHub
};
