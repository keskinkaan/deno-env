---
name: Bug Report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug Description

A clear and concise description of the bug.

## Steps to Reproduce

1. Import module '...'
2. Configure with '...'
3. Run code '...'
4. See error

## Expected Behavior

A clear description of what you expected to happen.

## Actual Behavior

A clear description of what actually happened.

## Code Example

```typescript
import { createEnv } from '@kaan/env';

// Minimal code that reproduces the issue
const config = await createEnv({
	API_KEY: {
		type: 'string',
		required: true,
	},
	PORT: {
		type: 'number',
		default: 3000,
	},
}).load({
	path: '.env',
	strict: true,
});

// Show where the error occurs
console.log(config.API_KEY);
```

## Environment

- Deno version: [e.g. 1.0.0]
- OS: [e.g. macOS 10.15.4]
- Package version: [e.g. 1.0.0]

## Additional Context

Add any other context about the problem here.
