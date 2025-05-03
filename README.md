# Gmail Job Search Filter Utility

This project is a Node.js utility that connects to your Gmail account via the Gmail API, fetches recent incoming emails, filters them using job-search-related keywords, and displays the relevant messages in a web interface. It includes email details like subject, sender, and date.

## Features

- Connects securely to your Gmail account
- Fetches recent incoming messages
- Filters emails by custom keywords (e.g., "position", "job", etc.)
- Displays relevant job-related messages in a clean UI

## Setup Instructions

### 1. Enable Gmail API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services > Library**.
4. Search for **Gmail API** and enable it.
5. Go to **APIs & Services > Credentials**.
6. Click **Create Credentials** > **OAuth client ID**.
7. Set up the OAuth consent screen (if you haven't already).
8. Choose **Web application**, and add `http://localhost:3000` (or your port) as an authorized redirect URI.
9. Download the credentials file (usually named `client_secret_XXXX.json`).

### 2. Add Credentials to Your Project

- Rename the downloaded file to `credentials.json`.
- Place it in the root directory of this project.

### 3. Install Dependencies

```bash
npm install

4. Run the Server
node server.js

Then open http://localhost:3001 in your browser to view the filtered emails.
