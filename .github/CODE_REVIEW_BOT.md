# AI Code Review Bot

An automated code review bot that uses OpenAI GPT-4o-mini to analyze pull request changes and provide actionable feedback.

## Features

- Automatic code review on every PR (opened, synchronized, reopened)
- Focuses on bugs, security issues, performance, and best practices
- TypeScript/React Native aware reviews
- Configurable skip patterns for binary and generated files
- Updates existing review comments instead of creating duplicates
- Provides clear recommendations (Approve, Request Changes, Comment)

## Setup

### 1. Add Required Secret

Add the following secret to your repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add: `OPENAI_API_KEY` - Your OpenAI API key

### 2. Verify Workflow Permissions

Ensure GitHub Actions has permission to write to pull requests:

1. Go to **Settings** > **Actions** > **General**
2. Under "Workflow permissions", select **Read and write permissions**
3. Check **Allow GitHub Actions to create and approve pull requests**

### 3. (Optional) Configure the Bot

Edit `.github/code-review-config.json` to customize:

```json
{
  "enabled": true,
  "model": "gpt-4o-mini",
  "maxTokens": 4096,
  "temperature": 0.3,
  "skipPaths": ["node_modules", "dist"],
  "reviewFocus": ["bugs", "security", "performance"]
}
```

## How It Works

1. When a PR is opened or updated, the workflow triggers
2. The bot fetches the PR diff using GitHub CLI
3. The diff is parsed and filtered (skipping binary/lock files)
4. OpenAI analyzes the changes with project-specific context
5. A review comment is posted (or updated) on the PR

## Review Output Format

The bot provides feedback in this format:

```markdown
### Summary
Brief overview of the changes

### Findings

#### Critical Issues
- **[filename:line]** Issue description

#### Warnings
- **[filename:line]** Potential problem

#### Suggestions
- **[filename:line]** Improvement idea

#### What's Good
- Positive feedback

### Recommendation
**Approve** / **Request Changes** / **Comment**
```

## Cost Considerations

- Uses `gpt-4o-mini` for cost efficiency
- Large PRs are chunked to stay within token limits
- Estimated cost: ~$0.01-0.05 per review (depending on PR size)

## Troubleshooting

### Review not appearing
- Check that `OPENAI_API_KEY` secret is set
- Verify workflow permissions allow PR comments
- Check the Actions tab for error logs

### Empty or minimal review
- The bot skips binary files, lock files, and generated code
- Very small changes may result in brief reviews

### API rate limits
- If you hit OpenAI rate limits, consider upgrading your API plan
- The bot uses conservative token limits to minimize costs

## File Structure

```
.github/
├── workflows/
│   └── code-review.yml      # GitHub Actions workflow
├── scripts/
│   └── code-review.js       # Review script
├── code-review-config.json  # Configuration
└── CODE_REVIEW_BOT.md       # This documentation
```
