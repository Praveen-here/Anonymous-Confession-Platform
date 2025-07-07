const axios = require('axios');

// Custom keywords to block (add more as needed)
const bannedKeywords = [
  "gandu", "nkn", "namman", "nmn", "vade",
  "shede", "sade", "sede", "nanmagne", "akka tangi",
  "chutiya",
];

// Normalize and check for banned words
function containsBannedKeyword(text) {
  const lowerText = text.toLowerCase();
  return bannedKeywords.some(keyword => lowerText.includes(keyword));
}

// Use Google Perspective API to evaluate toxicity
async function isToxicWithPerspective(text) {
  try {
    const apiKey = process.env.PERSPECTIVE_API_KEY;
    if (!apiKey) return true; // If key not available, allow

    const response = await axios.post(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
      {
        comment: { text },
        languages: ['en'],
        requestedAttributes: {
          TOXICITY: {}, SEVERE_TOXICITY: {}, INSULT: {}, PROFANITY: {}
        }
      }
    );

    const scores = response.data.attributeScores;
    const toxicity = scores.TOXICITY?.summaryScore?.value || 0;
    const severeToxicity = scores.SEVERE_TOXICITY?.summaryScore?.value || 0;
    const insult = scores.INSULT?.summaryScore?.value || 0;
    const profanity = scores.PROFANITY?.summaryScore?.value || 0;

    // Adjust thresholds as needed
    if (toxicity > 0.8 || severeToxicity > 0.5 || insult > 0.7 || profanity > 0.7) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('Perspective API error:', err.message);
    return false; // On error, treat as non-toxic to avoid blocking legitimate messages
  }
}

// Main moderation function
async function moderateText(text) {
  if (!text || typeof text !== 'string') return false;

  if (containsBannedKeyword(text)) return false;

  const isToxic = await isToxicWithPerspective(text);
  if (isToxic) return false;

  return true;
}

module.exports = { moderateText };
