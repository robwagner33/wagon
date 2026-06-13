# Wagon Development Guidelines

This document contains information about how to work within this codebase. Follow these guidelines when evaluating prompts.

# Project Overview

Wagon is the shared map/tilemap core consumed by the games (dungo, hockey) and by the wainwright editor. It exports the `MapDoc` types and map logic via `./core` (`src/index.ts`) with no runtime deps. Keep it framework-light and self-contained — it is the reuse boundary that several projects build on, so changes here ripple outward; favor stable, minimal APIs.

# Development Philosophy

Simplicity: Write simple, straightforward code
Readability: Make code easy to understand for a human
Performance: Consider performance without sacrificing readability
Maintainability: Write code that's easy to update
Testability: Ensure code is testable
Reusability: Create reusable components and functions
Less Code = Less Debt: Minimize code footprint
Stay Consistent: Try to match existing patterns in the codebase where possible

# Coding Best Practices

Early Returns: Use to avoid nested conditions
Descriptive Names: Use clear variable/function names
DRY Code: Don't repeat yourself
Minimal Changes: Only modify code related to the task at hand
Function Ordering: Define composing functions before their components
Simplicity: Prioritize simplicity and readability over clever solutions
Build Iteratively Start with minimal functionality and verify it works before adding complexity
File Organsiation: Balance file organization with simplicity - use an appropriate number of files for the project scale
Avoid Long chains: Break down method chains when they get too long and use multiple assignments instead. For example:

```
const results = someArray.map(otherArray.map(a => a.val), a => a.val)
```

Should instead be

```
const intermediateArr = otherArray.map(a => a.val)
const results = someArray(otherSum, a => a.val)
```

Use intuitive names for what the intermediate array should be.
Don't remove existing comments
