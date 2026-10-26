---
name: comprehensive-code-summary
description: Enforces an exhaustive, natural-language narrative explanation of all code changes, file modifications, architectural logic, edge cases, and verification steps after writing or refactoring code. Use when detailed step-by-step code change walkthroughs are required.
---

# Detailed Code Walkthrough & Change Summary Skill

## Purpose
This skill ensures that whenever code is written, modified, or refactored, the response does not just dump raw code blocks or brief bullet points. Instead, it forces a deep, natural-language explanation of **exactly what happened** inside each file, covering data flows, control structures, and functional changes.

## Execution Rules

1. **Mandatory Natural-Language Narrative:** For every file created or modified, explain the *how* and *why* in detailed, readable paragraphs. Describe data flows, state changes, input/output behaviors, and internal logic step-by-step.
2. **Prohibit Surface-Level Summaries:** Never use vague bullet points such as *"Updated logic"*, *"Added validation"*, or *"Refactored code"*. You must state *what* validation was added, *which* fields it inspects, and *how* errors or responses are handled.
3. **Exhaustive File Manifest:** List every single file created, modified, or deleted. Grouping multiple files under a single generic description is strictly forbidden.
4. **Transparent Reasoning:** Explicitly state the rationale behind patterns used (e.g., why a specific data structure, library, or algorithm was chosen) and any assumptions or trade-offs made.
5. **Proactive Risk Analysis:** Detail edge cases handled (e.g., null values, network failures, race conditions, type conversions) and explicitly flag potential side effects on existing code.
6. **Actionable Verification:** Provide exact, copy-pasteable terminal commands required to test, build, or verify the updates.

---

## Required Output Format

Conclude your code response with the following exact layout:

### 📋 Detailed Code Change Walkthrough

1. **High-Level Implementation Overview:**
   - 2–3 sentences summarizing the primary goal accomplished and how the solution integrates into the overall architecture.

2. **File-by-File Narrative Manifest:**
   - **`path/to/file.ext`** *(Created / Modified / Deleted)*:
     - **Narrative Walkthrough:** Write a descriptive paragraph explaining exactly what changed inside this file. Describe functions/classes introduced or modified, data flow, conditions checked, and error handling.
     - **Key Logic Highlights:** Detail specific variables, logic flow updates, or structural changes.

3. **Architectural & Design Choices:**
   - Rationale for the chosen pattern, library, or logic flow over alternatives.
   - Key assumptions or performance/complexity trade-offs accepted.

4. **Potential Side Effects & Edge Cases:**
   - Specific edge cases handled (or left as future improvements).
   - Downstream impact on existing dependencies, database schemas, or tests.

5. **Next Steps / Verification:**
   - Exact terminal command(s) to run for verification:
     ```bash
     # Example verification command
     ```
   - Manual verification steps if applicable.