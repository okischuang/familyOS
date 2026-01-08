#!/usr/bin/env node

/**
 * AI Code Review Script
 *
 * This script analyzes PR diffs using OpenAI and generates review comments.
 * It focuses on:
 * - Code quality and best practices
 * - Potential bugs and security issues
 * - Performance considerations
 * - TypeScript/React Native specific patterns
 */

const fs = require('fs');
const https = require('https');

// Configuration
const CONFIG = {
  model: 'gpt-4o-mini',
  maxTokens: 4096,
  temperature: 0.3,
};

// Review categories with severity levels
const REVIEW_CATEGORIES = {
  CRITICAL: 'Critical',
  WARNING: 'Warning',
  SUGGESTION: 'Suggestion',
  PRAISE: 'Praise',
};

/**
 * Make an HTTPS request
 */
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/**
 * Call OpenAI API for code review
 */
async function callOpenAI(prompt, systemPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const requestBody = JSON.stringify({
    model: CONFIG.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: CONFIG.maxTokens,
    temperature: CONFIG.temperature,
  });

  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(requestBody),
    },
  };

  const response = await makeRequest(options, requestBody);
  return response.choices[0].message.content;
}

/**
 * Parse the diff file and extract meaningful changes
 */
function parseDiff(diffContent) {
  const files = [];
  const fileSections = diffContent.split(/^diff --git/gm).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split('\n');
    const fileMatch = lines[0].match(/a\/(.+?) b\/(.+)/);

    if (!fileMatch) continue;

    const filePath = fileMatch[2];
    const additions = [];
    const deletions = [];
    let currentLine = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
        if (match) currentLine = parseInt(match[1], 10) - 1;
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        currentLine++;
        additions.push({ line: currentLine, content: line.substring(1) });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions.push({ content: line.substring(1) });
      } else if (!line.startsWith('\\')) {
        currentLine++;
      }
    }

    files.push({
      path: filePath,
      additions,
      deletions,
      raw: section,
    });
  }

  return files;
}

/**
 * Filter files to review (skip certain file types)
 */
function shouldReviewFile(filePath) {
  const skipPatterns = [
    /\.lock$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.svg$/,
    /\.ico$/,
    /\.woff/,
    /\.ttf$/,
    /\.eot$/,
    /\.min\./,
    /node_modules/,
    /\.map$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
  ];

  return !skipPatterns.some((pattern) => pattern.test(filePath));
}

/**
 * Chunk files for processing to avoid token limits
 */
function chunkFiles(files, maxChunkSize = 15000) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const file of files) {
    const fileSize = file.raw.length;

    if (currentSize + fileSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(file);
    currentSize += fileSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Generate the system prompt for code review
 */
function getSystemPrompt() {
  return `You are an expert code reviewer for a React Native (Expo) project with Firebase backend.
Your role is to provide constructive, actionable feedback on pull request changes.

## Project Context
- Tech Stack: React Native (Expo), Firebase (Auth, Firestore, Functions), TypeScript, OpenAI API
- The app is called "Laxie" - a family coordination agent
- Code should follow TypeScript strict mode
- Use functional components with hooks
- Follow NativeWind/Tailwind for styling

## React Native Best Practices to Check

### Hooks & State Management
- useEffect must have proper dependency arrays (no missing dependencies)
- useEffect cleanup functions for subscriptions, timers, and listeners
- useMemo/useCallback for expensive computations and callback stability
- Avoid state updates on unmounted components
- Prefer Zustand/Redux selectors to prevent unnecessary re-renders

### List Performance
- Use FlatList instead of ScrollView for long lists
- Always provide unique keyExtractor (never use index as key for dynamic lists)
- Implement getItemLayout for fixed-height items
- Use windowSize, maxToRenderPerBatch, updateCellsBatchingPeriod for large lists
- Avoid inline functions and objects in renderItem

### Memory & Performance
- Clean up event listeners in useEffect return function
- Unsubscribe from Firebase listeners on unmount
- Avoid anonymous functions in JSX props (use useCallback)
- Use React.memo for pure functional components
- Avoid spreading props unnecessarily ({...props})
- Use Reanimated for complex animations (not Animated API)

### Platform-Specific Code
- Use Platform.select() or Platform.OS for platform differences
- Verify behavior on both iOS and Android
- Use SafeAreaView or useSafeAreaInsets for notch handling
- Handle keyboard properly with KeyboardAvoidingView (behavior differs iOS/Android)

### Navigation (React Navigation)
- Don't pass functions or non-serializable data in route params
- Use navigation.setOptions in useLayoutEffect, not useEffect
- Avoid navigation actions in render phase

### Images & Assets
- Always specify width/height for Image components
- Use resizeMode appropriately
- Prefer expo-image or FastImage for better caching
- Avoid large images in bundle; use remote URLs with caching

### Firebase Specific
- Handle auth state changes with onAuthStateChanged listener
- Use proper Firestore query limits and pagination
- Clean up Firestore onSnapshot listeners
- Handle offline persistence appropriately

### Security
- Never hardcode API keys or secrets (use environment variables)
- Validate user input before Firestore writes
- Use Firestore security rules (don't rely on client-side validation alone)
- Sanitize data from external sources

## Review Guidelines
Focus on:
1. **Bugs & Logic Errors**: Runtime errors, logic flaws, edge cases, null/undefined access
2. **Security Issues**: Credential exposure, injection risks, insecure data handling
3. **Performance**: Re-renders, memory leaks, list performance, bundle size
4. **React Native Patterns**: Proper hook usage, navigation, platform handling
5. **Code Quality**: Readability, maintainability, proper error handling, TypeScript types

## Response Format
Provide your review in this exact markdown format:

### Summary
A brief 1-2 sentence summary of the overall changes.

### Findings

#### Critical Issues
- **[filename:line]** Description of critical issue that must be fixed

#### Warnings
- **[filename:line]** Description of potential problem

#### Suggestions
- **[filename:line]** Improvement suggestion

#### What's Good
- Brief praise for well-written code patterns

### Recommendation
Your overall recommendation: **Approve**, **Request Changes**, or **Comment**

If there are no issues in a category, omit that section. Be concise and specific.`;
}

/**
 * Main review function
 */
async function reviewCode() {
  console.log('Starting AI Code Review...');

  // Read the diff
  const diffPath = 'pr_diff.txt';
  if (!fs.existsSync(diffPath)) {
    console.error('No diff file found');
    fs.writeFileSync(
      'review_output.md',
      'No changes detected or diff file not available.'
    );
    return;
  }

  const diffContent = fs.readFileSync(diffPath, 'utf8');

  if (!diffContent.trim()) {
    console.log('Empty diff, nothing to review');
    fs.writeFileSync('review_output.md', 'No changes to review.');
    return;
  }

  // Parse and filter files
  const allFiles = parseDiff(diffContent);
  const filesToReview = allFiles.filter((f) => shouldReviewFile(f.path));

  console.log(`Found ${allFiles.length} files, reviewing ${filesToReview.length}`);

  if (filesToReview.length === 0) {
    fs.writeFileSync(
      'review_output.md',
      'No reviewable code changes found (only binary/config files changed).'
    );
    return;
  }

  // Get PR context
  const prTitle = process.env.PR_TITLE || 'No title';
  const prBody = process.env.PR_BODY || 'No description';

  // Chunk files and review
  const chunks = chunkFiles(filesToReview);
  const reviews = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Reviewing chunk ${i + 1}/${chunks.length}...`);

    const chunk = chunks[i];
    const fileList = chunk.map((f) => f.path).join(', ');
    const diffText = chunk.map((f) => f.raw).join('\n\n');

    const prompt = `## Pull Request
**Title:** ${prTitle}
**Description:** ${prBody}

## Files Changed
${fileList}

## Diff
\`\`\`diff
${diffText}
\`\`\`

Please review these changes and provide feedback.`;

    try {
      const review = await callOpenAI(prompt, getSystemPrompt());
      reviews.push(review);
    } catch (error) {
      console.error(`Error reviewing chunk ${i + 1}:`, error.message);
      reviews.push(`*Error reviewing files: ${fileList}*`);
    }
  }

  // Combine reviews
  let finalReview;

  if (reviews.length === 1) {
    finalReview = reviews[0];
  } else {
    // Summarize multiple chunk reviews
    const combinedPrompt = `You reviewed a PR in multiple parts. Combine these reviews into a single cohesive review:

${reviews.map((r, i) => `## Part ${i + 1}\n${r}`).join('\n\n')}

Provide a single unified review following the same format (Summary, Findings, Recommendation).`;

    try {
      finalReview = await callOpenAI(combinedPrompt, getSystemPrompt());
    } catch (error) {
      console.error('Error combining reviews:', error.message);
      finalReview = reviews.join('\n\n---\n\n');
    }
  }

  // Write output
  fs.writeFileSync('review_output.md', finalReview);
  console.log('Review complete! Output written to review_output.md');
}

// Run the review
reviewCode().catch((error) => {
  console.error('Fatal error:', error);
  fs.writeFileSync(
    'review_output.md',
    `Error during code review: ${error.message}`
  );
  process.exit(1);
});
