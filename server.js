import express from 'express';
import axios from "axios";
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import bodyParser from "body-parser";
import * as cheerio from 'cheerio';
import { error } from 'console';



const app = express();
const port = 3001;
const baseURL = "https://gmail.googleapis.com";
const rawData = await fs.readFile('credentials.json', 'utf8');
const credentials = JSON.parse(rawData);
const userId = credentials.web.client_id;
var authorizedClient;
var mails = [];

function Mail(subject, body, sender, date, status, position) {
    this.sender = sender;
    this.date = date;
    this.subject = subject;
    this.body = body;
    this.status = status;
    this.position = position;

}

var names = {
    "Mastercard <talent@careers.mastercard.com>": "MasterCard", "inManage <no-reply@inmanage.comeet-notifications.com>": "inManage",
    "WalkMe <no-reply@hire.lever.co>": "walkMe", "Mize <no-reply@mize.comeet-notifications.com>": "Mize",
    "Siemens Talent Acquisition <talentacquisition.hr@siemens.com>": "Simens", "Wix Hiring Team <notifications@recruitment.wix.com>": "Wix",
    "Wix <notification@recruitment.wix.com>": "Wix",
    "Workday_no_reply cadence <cadence@myworkday.com>": "Cadence", "no-reply@jfrog.com": "Jfrog",
    "Mobileye <no-reply@hire.eu.lever.co>": "Mobileye", "no-reply@us.greenhouse-mail.io": "Lightricks",
    "Check Point HR <hr@checkpoint.com>": "Checkpoint", "Amazon-Recruiting <no-reply@panpowered.com>": "Amazon",
    "amazon-recruiting <no-reply@panpowered.com>": "Amazon", "Cisco Recruiting <donotreply@cisco.avature.net>": "Cisco",
    "NetApp Global Talent Acquisition <donotreply@successfactors.com>": "NetApp", "Workday@sciplay.com": "Sciplay",
    "Clarivate Analytics Workday <clarivate@myworkday.com>": "Clarivate", "Millennium Recruiting Team <millenniumrecruitingteam@careers.mlp.com>": "Millennium",
    "Dynatrace <notifications@successfactors.dynatrace.com>": "Dynatrace", "noreply@mail.amazon.jobs": "Amazon"
};

function getName(sender, names) {
    if (names) {
        for (const [key, value] of Object.entries(names)) {
            if (sender.includes(key)) {
                return value;
            }
        }
    }
    return sender;
}


// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * 
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH, 'utf8');
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}



async function startServer() {
    try {
        authorizedClient = await authorize(); // Only once, at startup
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Authorization failed:', error);
    }
}

startServer();


async function getAllMessages() {
    try {
        if (!authorizedClient) throw new Error("No authorized client");

        // Example call using the authorized client
        const gmail = google.gmail({ version: "v1", auth: authorizedClient });
        const result = await gmail.users.messages.list({
            userId: "me",
            q: "in:inbox after:2025/04/15",
        });
        return result.data.messages;
    } catch {
        console.error(error);
    }
}

function getWordsBefore(text, keyword) {
    const words = text.split(/\s+/); // split by any whitespace
    const index = words.findIndex(word => word.includes(keyword));

    if (index === -1 || index < 2) {
        return "software engineer"; // keyword not found or not enough words before it
    }
    let position = words.slice(index - 2, index).join(' ');
    if (position.includes("for a") || position.includes("for the")) {
        position = "software engineer";
    }
    return position;
}

async function getMessagesContent(data) {
    const gmail = google.gmail({ version: "v1", auth: authorizedClient });
  
    const mailPromises = data.map(async (message) => {
      const messageId = message.id;
  
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });
  
      const headers = res.data.payload.headers;
  
      // Extract fields
      const subject = headers.find(h => h.name === 'Subject')?.value;
      const sender = headers.find(h => h.name === 'From')?.value;
      const date = headers.find(h => h.name === 'Date')?.value;
  
      let body = '';
      if (res.data.payload.parts) {
        const part = res.data.payload.parts.find(p => p.mimeType === 'text/plain');
        if (part?.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else {
          const htmlPart = res.data.payload.parts.find(p => p.mimeType === 'text/html');
          if (htmlPart?.body?.data) {
            body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
            const $ = cheerio.load(body);
            body = $('body').text(); // Extract plain text from HTML
          }
        }
      } else if (res.data.payload.body?.data) {
        body = Buffer.from(res.data.payload.body.data, 'base64').toString('utf-8');
      }
  
      let position = getWordsBefore(body, "position");
      let name = getName(sender, names);
      console.log("name is:", name);
  
      return new Mail(subject, body, name, date, "sent", position);
    });
  
    // Await all messages concurrently
    const mails = await Promise.all(mailPromises);
    return mails;
  }
  

function searchApplicationMails(mails) {

    let fitMails = [];

    const keywords = ["application", "applying ", "position ", "apply", "We will update you as soon as possible"];

    mails.forEach(mail => {
        if (keywords.some(word => mail.body.includes(word))) {
            fitMails.push(mail);
        } else if (keywords.some(word => mail.subject.includes(word))) {
            fitMails.push(mail);
        }
    });
    return fitMails;
}


app.get("/",async (req, res) => {
    const mails = await getAllMessages()
    .then(getMessagesContent)
    .catch((error) => {
      console.error('Error occurred:', error);
    });
    let fitMails = searchApplicationMails(mails);
    res.render("index.ejs",{mails:fitMails});
});


