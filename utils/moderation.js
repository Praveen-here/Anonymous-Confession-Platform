const { MongoClient } = require('mongodb');
const perspectiveKey = process.env.PERSPECTIVE_API_KEY;

let cachedWords = [];

async function loadBannedWords() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(); // use default db from URI
  const doc = await db.collection('banned_words').findOne();
  cachedWords = doc?.words || [];
  await client.close();
}

function containsCustomBannedWords(text) {
  const lowercaseText = text.toLowerCase();
  return cachedWords.some(word => lowercaseText.includes(word));
}

async function moderateText(text) {
  if (containsCustomBannedWords(text)) return false;

  const response = await fetch(
    `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${perspectiveKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: { text },
        languages: ['en'],
        requestedAttributes: { TOXICITY: {} }
      })
    }
  );
  const result = await response.json();
  const score = result.attributeScores?.TOXICITY?.summaryScore?.value || 0;
  return score < 0.7;
}

module.exports = {
  moderateText,
  loadBannedWords
};
