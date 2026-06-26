Claude System Instructions
Cost Control & Sub-agents
DO NOT spawn sub-agents for simple, local, or single-file tasks.
If a sub-agent is absolutely necessary, instruct it to be brief and return to the main thread immediately.
Never enter into an automated loop of more than 3 attempts to fix a bug. If it fails, stop and ask the user for guidance.
Session Management
Remind the user to run /compact or /clear if the conversation becomes too long or if the topic changes.

Development & Code Guidelines
Mobile-First / Responsive: Ensure all UI components and pages are fully responsive. Check for overflow, wrapping, and touch-target sizes on mobile screens. Prevent any visual regressions or layout bugs on mobile devices.

Always use clean, semantic HTML and standard CSS/Tailwind practices for responsive design.

Interaction Workflow
Before making any code modifications, briefly list your action plan in 3-4 bullet points maximum.

Wait for user confirmation before writing or modifying any code.

