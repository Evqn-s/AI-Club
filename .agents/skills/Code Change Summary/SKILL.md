---
name: comprehensive-code-summary
description: Generate a structured, comprehensive summary of changes, file manifests, architectural choices, edge cases, and verification steps after writing or modifying code. Use when the user asks for a detailed explanation of code changes, code summaries, or implementation reviews.
---

# Comprehensive Code Summary Skill

## Purpose
This skill ensures that whenever code is written, modified, or refactored, the response does not just dump raw code blocks and stop. Instead, it forces a rigorous, multi-point breakdown of what was changed, why it was changed, potential risks, and how to verify it.

## Execution Rules

1. **Mandatory Conclusion:** Every time code generation or file modification is completed, you MUST conclude your response with the **Change Summary Report**. Never omit this section, even for small changes.
2. **Exhaustive File Manifest:** List every single file created, modified, or deleted. Do not group unrelated changes under a vague description; break them down per file.
3. **Transparent Reasoning:** Under architectural choices, explicitly state the rationale behind patterns used (e.g., why a specific data structure, library, or error-handling pattern was chosen) and any assumptions made.
4. **Proactive Risk Analysis:** Always think critically about edge cases (e.g., null pointers, race conditions, type mismatches, missing environment variables) and side effects on other components.
5. **Actionable Verification:** Provide exact, copy-pasteable terminal commands required to test or lint the code (e.g., `pytest tests/test_foo.py`, `npm run build`).

---

## Required Output Format

Conclude your code response with the following exact layout:

### 📋 Change Summary Report

1. **High-Level Overview:**
   - 1–2 sentences summarizing the primary goal accomplished in this implementation.

2. **File Manifest & Changes:**
   - **`path/to/file.ext`** *(Created / Modified / Deleted)*:
     - Specific change or addition 1.
     - Specific change or addition 2.

3. **Architectural & Design Choices:**
   - Rationale for the chosen pattern, library, or logic flow.
   - Key assumptions or trade-offs accepted.

4. **Potential Side Effects & Edge Cases:**
   - Identified edge cases handled (or left as future improvements).
   - Impact on existing dependencies, schemas, or tests.

5. **Next Steps / Verification:**
   - Exact terminal command(s) to run for verification:
     ```bash
     # Example command
     ```