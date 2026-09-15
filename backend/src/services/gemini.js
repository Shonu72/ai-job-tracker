// Google Gen AI SDK — Vertex AI backend with Application Default Credentials.
// No API key required. Authenticates via ADC (service account, Cloud Shell,
// gcloud auth application-default login, or GOOGLE_APPLICATION_CREDENTIALS).
const { GoogleGenAI } = require('@google/genai');

const PROJECT = process.env.GCP_PROJECT_ID || 'qwiklabs-gcp-02-487c653354db';
const REGION = process.env.GCP_REGION || 'us-central1';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: REGION,
});

async function callGemini(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      maxOutputTokens: 700,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini returned no content');
  return text.trim();
}

/**
 * Build a grounded prompt using the application/job context plus the user's
 * own historical drafts, then ask Gemini for a tailored cover letter.
 */
function buildCoverLetterPrompt({ company, role, location, jobDescription, pastDrafts }) {
  const history = pastDrafts.length
    ? `Here are examples of the candidate's past cover letters, for tone and style consistency:\n\n` +
      pastDrafts.map((d, i) => `Example ${i + 1}:\n${d.contents}`).join('\n\n')
    : 'No past cover letters are available yet, so use a confident, professional default tone.';

  return `You are helping a job seeker write a tailored cover letter.

Target company: ${company}
Target role: ${role}
Location: ${location || 'Not specified'}
Job description / posting details: ${jobDescription || 'Not provided'}

${history}

Write a concise, specific, and enthusiastic cover letter (250-350 words) for this application.
Avoid generic filler. Reference concrete aspects of the role or company where possible.
Return only the letter text, no preamble.`;
}

function buildFollowUpPrompt({ company, role, applicationDate, status, pastDrafts }) {
  const history = pastDrafts.length
    ? `Past follow-up emails from this candidate, for tone consistency:\n\n` +
      pastDrafts.map((d, i) => `Example ${i + 1}:\n${d.contents}`).join('\n\n')
    : 'No past follow-up emails are available yet.';

  return `You are helping a job seeker write a polite follow-up email.

Company: ${company}
Role: ${role}
Original application date: ${applicationDate}
Current pipeline status: ${status}

${history}

Write a short, polite follow-up email (under 150 words) checking on the status of this application.
Return only the email text, no preamble.`;
}

module.exports = { callGemini, buildCoverLetterPrompt, buildFollowUpPrompt };
