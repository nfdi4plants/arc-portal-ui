# AGENTS.md

## Testing Guidelines

- **Test only user-reachable states.** Tests should cover realistic scenarios users can encounter through normal application usage, not artificial states requiring scripts, manual manipulation, or contrived sequences.
- **Prioritize practical failures.** Focus on common workflows, meaningful regressions, and issues with actual user impact.
- **Avoid overengineering rare edge cases.** Do not implement large or complex fixes for extremely unlikely issues that are easily self-healing (e.g., resolved by another user interaction).
- **Consider the risks of every fix.** Do not introduce significant complexity, maintenance burden, or potential instability to prevent an edge case with negligible practical impact.
- **Prefer simplicity and robustness.** Accept minor, recoverable imperfections when preventing them would make the overall system more fragile.

**Guiding principle:** Optimize for realistic user experience and maintainability, not theoretical correctness in unreachable or negligible scenarios.