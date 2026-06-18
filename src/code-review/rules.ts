/**
 * Nexus-Dev MMFE — Language-Specific Review Rules
 *
 * Adapted from Alibaba Open Code Review's rule_docs/ directory.
 * Each language gets a tailored review checklist injected into the LLM prompt.
 */

import type { ReviewLanguage } from './types.js';

const rules: Record<ReviewLanguage, string> = {
  default: `#### Correctness
Is the logic correct? Are there missing boundary conditions?
Are exceptions handled properly?
Is it thread-safe in concurrent scenarios?

#### Security
Are there security vulnerabilities such as SQL injection or XSS?
Is sensitive information handled correctly?
Is permission validation complete?

#### Performance
Are there obvious performance issues (e.g., N+1 queries, unnecessary loops)?
Are resources properly released?

#### Maintainability
Is the code clear and easy to understand?
Do names accurately express intent?
Does it follow the project's existing code style and architecture patterns?

#### Test Coverage
Do critical logic paths have corresponding test cases?
Do test cases cover boundary conditions?`,

  typescript: `#### Obvious Typos or Spelling Errors
- Spelling errors in variable names, function names, component names, or Props property names
- Strings in log or error messages containing spelling errors that affect readability

#### Dead Code
- Code blocks that will never be executed (e.g., branches where the condition is always false, code after a return statement)
- Variables that are declared but never read or referenced
- Large blocks of commented-out code (with no apparent intent to retain)

#### Code Quality Checks
- **Duplicate Code**: Check for common logic that can be extracted
- **Code Comments**: Complex business logic should have clear explanatory comments (avoid commenting obvious code)
- **Hardcoding**: Business-related hardcoded strings are prohibited, especially URL paths and business numbers; simple UI text may be relaxed
- **Variable Declarations**: Using \`var\` is strictly prohibited; use \`let\` or \`const\`
- **Equality Comparisons**: Using \`==\` and \`!=\` is prohibited; use strict equality \`===\` and \`!==\`
- **TypeScript Types**: Avoid using \`any\` type; if necessary, provide a comment explaining the reason
- **Null Checks**: Perform null checks when accessing values or destructuring to avoid null pointer exceptions
- **Ternary Expressions**: Nested ternary expressions are not allowed

#### React Best Practices
- **Hooks Usage**: Verify compliance with Hooks rules (only call at the top level, only call in React functions)
- **State Management**: Ensure state is placed at the appropriate level; avoid unnecessary state lifting
- **Side Effect Handling**: Verify useEffect correctly handles dependencies and cleanup functions
- **Performance Optimization**: Verify proper use of React.memo, useMemo, useCallback (based on performance analysis; avoid over-optimization)
- **Render Side Effects**: Side effects in React component render methods are strictly prohibited (e.g., API calls, DOM manipulation)
- **Inline Styles**: Avoid using inline \`style\` attributes, except for dynamic styles
- **Inner Components**: Declaring new components inside a component is prohibited; use render methods instead

#### Async Handling Standards
- **Error Handling**: Async functions must include proper error handling with user-friendly error messages
- **Prefer async/await**: Prefer async/await over Promises; callback hell is prohibited
- **Async in Loops**: Distinguish between independent async operations (use \`Promise.all\` for parallelism) and dependent async operations (use sequential execution); prefer \`Promise.all\` for performance

#### Code Security Checks
- **XSS Protection**: Verify that user input is properly escaped
- **innerHTML Safety**: Using innerHTML to directly insert user input is prohibited; use textContent or apply XSS protection
- **Code Injection Protection**: Using eval(), Function() constructor, and string argument forms of setTimeout/setInterval is strictly prohibited
- **Dangerous Methods**: Using document.write() is prohibited as it causes page reflow and security issues
- **Sensitive Information**: Check whether API keys or sensitive data are exposed
- **Prototype Chain Safety**: Modifying native object prototypes (e.g., Array.prototype, Object.prototype) is prohibited`,

  javascript: `#### Obvious Typos or Spelling Errors
- Spelling errors in variable names, function names, component names, or property names
- Strings in log or error messages containing spelling errors that affect readability

#### Dead Code
- Code blocks that will never be executed (e.g., unreachable branches, code after return)
- Variables declared but never read or referenced
- Large blocks of commented-out code with no intent to retain

#### Code Quality Checks
- **Variable Declarations**: Using \`var\` is strictly prohibited; use \`let\` or \`const\`
- **Equality Comparisons**: Using \`==\` and \`!=\` is prohibited; use strict equality \`===\` and \`!==\`
- **Null Checks**: Perform null/undefined checks when accessing nested properties
- **Ternary Expressions**: Nested ternary expressions are not allowed
- **Duplicate Code**: Check for common logic that can be extracted
- **Hardcoding**: Business-related hardcoded strings are prohibited

#### Async Handling Standards
- **Error Handling**: Async functions must include proper error handling
- **Prefer async/await**: Prefer async/await over raw Promises; callback hell is prohibited
- **Async in Loops**: Use Promise.all for independent operations, sequential for dependent ones

#### Code Security Checks
- **XSS Protection**: Verify that user input is properly escaped
- **innerHTML Safety**: Using innerHTML with user input is prohibited
- **Code Injection Protection**: eval(), Function() constructor, and string-arg setTimeout/setInterval are prohibited
- **Sensitive Information**: Check whether API keys or sensitive data are exposed`,

  java: `#### Obvious Typos or Spelling Errors
- Spelling errors in variable names, method names, or class names at their declaration sites
- Strings in log messages or exception messages containing spelling errors
- Do not report spelling errors at reference sites

#### Dead Code
- Code blocks that can never be reached (e.g., always-false branches, code after return)
- Variables declared but never read or referenced
- Large blocks of commented-out code with no intent to preserve

#### Logic Error Detection
- Incorrect if-condition logic (examine surrounding context to confirm expected logic)
- Boundary condition handling errors (pay special attention to index and array length checks)
- Misuse of boolean logic operators (precedence and short-circuit evaluation)
- Obvious infinite loops or recursion without termination conditions
- Missing break statements in switch cases causing unintended fall-through
- Code patterns that may cause NPE (inspect the data source call chain)
- Missing parentheses in logical expressions causing different execution order

#### Severe Performance Issues
- Database queries executed inside loops (confirm whether the method involves database operations)
- N+1 query problems (suggest batch query optimizations)
- Processing large datasets without pagination
- Inefficient algorithm implementations (O(n^2) or higher where better exists)

#### Thread Safety Issue Detection
- **Race conditions**: A "check-then-act" pattern where intermediate state may be altered
- **Non-atomic compound operations**: Multi-step operations lacking synchronization
- **Unsafe lazy initialization**: Double-checked locking defects
- **Concurrent writes to thread-unsafe collections**: Modifications to ArrayList or HashMap in multi-threaded context
- Do NOT report: local variables, single-threaded context, read-only operations, immutable objects, properly synchronized code`,

  kotlin: `#### Obvious Typos or Spelling Errors
- Spelling errors in variable names, function names, or class names
- Strings in log or error messages

#### Null Safety
- Avoid using \`!!\` operator; prefer safe calls \`?.\` and \`?:\` (Elvis operator)
- Use \`require()\` or \`check()\` for precondition validation rather than \`!!\`
- Ensure platform types from Java interop are properly handled

#### Conciseness and Idiomatic Code
- Use expression bodies for simple functions
- Prefer \`when\` over chained if-else
- Use scope functions (\`let\`, \`run\`, \`with\`, \`apply\`, \`also\`) appropriately
- Use data classes for holding data, sealed classes for restricted hierarchies

#### Collection Optimization
- Prefer Sequence for large collections with multiple chained operations
- Use appropriate collection types (List vs Set vs Map)
- Avoid unnecessary collection copies

#### Coroutines
- Properly structured concurrency (viewModelScope, lifecycleScope)
- Handle cancellation properly
- Avoid blocking calls inside coroutines (use withContext(Dispatchers.IO))
- Proper exception handling in coroutine scopes`,

  rust: `#### Obvious Typos or Spelling Errors
- Spelling errors in type names, function names, variable names, enum variants, trait names, or module names at declaration sites
- Strings in log/panic/error messages containing spelling errors

#### Ownership and Lifetime Correctness
- Incorrectly returned references, borrowed values escaping their valid scope
- Excessive or unnecessary \`clone()\` calls where a borrow or ownership transfer would be clearer
- Interior mutability (\`RefCell\`, \`Cell\`, \`Mutex\`) used without real shared-mutability requirement
- Reference cycles with \`Rc<RefCell<T>>\` or \`Arc<Mutex<T>>\` where \`Weak\` should break cycles

#### Error Handling and Panics
- \`unwrap()\`, \`expect()\`, \`panic!\`, \`todo!\` in production/library paths where failure is recoverable
- Errors converted to strings too early or discarded without context
- \`Result\` or \`Option\` values ignored, swallowed, or mapped to misleading defaults
- Public APIs that panic on ordinary invalid input instead of returning a typed error

#### Unsafe Code Boundaries
- \`unsafe\` blocks broader than necessary or hiding multiple unrelated invariants
- Missing or stale safety rationale for \`unsafe\` blocks, \`unsafe fn\`, \`unsafe impl Send/Sync\`
- Raw pointer dereferences without clear validity, alignment, initialization, aliasing, and lifetime guarantees
- FFI boundaries not validating null pointers, buffer lengths, ownership transfer, or string encoding

#### Concurrency and Shared State
- Holding \`Mutex\`, \`RwLock\`, or \`RefCell\` guards longer than necessary
- Holding synchronous locks across \`.await\`
- Check-then-act races around shared state, cache initialization, or atomics
- Unsafe \`Send\` or \`Sync\` implementations that do not prove thread safety

#### Async and Cancellation Safety
- Spawned tasks whose \`JoinHandle\` is dropped when failures need observation
- Futures that are not cancellation-safe around partial writes, lock acquisition, or resource cleanup
- Async functions using synchronous filesystem/network/process APIs in request/worker paths
- Retry loops without backoff, timeout, cancellation propagation, or bounded attempts

#### Collections, Iterators, and Performance
- Avoid unnecessary allocations in hot paths (repeated String construction, format!, collect(), to_vec())
- Prefer iterator adapters and standard library collection APIs
- Ensure hash maps, vectors, and strings are preallocated when expected size is known
- Avoid O(n^2) lookups from nested loops when HashMap/HashSet would reduce complexity

#### Security-Sensitive Code
- Validate path, URL, command, SQL, and serialized input before use
- Do not log secrets, tokens, credentials, or personally identifiable information
- Check integer conversions, byte slicing, and length arithmetic for overflow
- Cryptographic, random, authentication, and authorization code must use well-reviewed crates`,

  cpp: `#### Smart Pointers and RAII
- Prefer std::unique_ptr, std::shared_ptr over raw owning pointers
- Use std::make_unique / std::make_shared instead of direct new
- Ensure RAII patterns for resource management (files, sockets, locks)

#### STL Containers and Algorithms
- Choose appropriate containers (vector for random access, list for frequent insertion/deletion, unordered_map for hash lookup)
- Use STL algorithms instead of hand-written loops when possible
- Reserve container capacity when size is known in advance

#### Memory Safety
- Check for dangling pointers, use-after-free, double-free
- Ensure proper initialization of variables before use
- Avoid buffer overflows (use std::array, std::vector, std::string instead of C arrays)
- Check for memory leaks (especially in error paths)

#### Concurrency
- Use std::mutex, std::shared_mutex, std::atomic appropriately
- Avoid data races (check-then-act patterns on shared state)
- Prefer lock-free algorithms when possible
- Ensure proper lock ordering to prevent deadlocks

#### Exception Safety
- Ensure strong exception guarantee where possible
- Avoid throwing in destructors
- Use RAII for cleanup instead of try/catch

#### const Correctness
- Mark methods that don't modify object state as const
- Use const references for parameters that shouldn't be modified
- Prefer constexpr for compile-time constants`,

  c: `#### Memory Management
- Ensure malloc/free pairing; check for memory leaks
- Avoid buffer overflows (use strncpy, snprintf instead of strcpy, sprintf)
- Initialize all variables before use
- Check return values of malloc/calloc for NULL
- Free allocated memory in all code paths (especially error paths)

#### Safe String Operations
- Use bounded string functions (strncpy, snprintf, strncat)
- Ensure null termination of strings
- Check buffer sizes before copying

#### Error Handling
- Check return values of system calls and library functions
- Use proper error codes or return values
- Clean up resources in error paths

#### Security
- Validate all input (buffer sizes, array indices, format strings)
- Avoid format string vulnerabilities (never pass user input as format string)
- Check for integer overflow in calculations involving sizes or offsets
- Do not use gets() - use fgets() instead`,

  go: `#### Error Handling
- Always check error return values; never discard errors with \`_\`
- Wrap errors with context using fmt.Errorf("...: %w", err) for error chain
- Handle errors at the appropriate level (return, retry, or handle)

#### Concurrency
- Use sync.WaitGroup for goroutine coordination
- Avoid goroutine leaks (ensure all goroutines can terminate)
- Use buffered channels appropriately
- Avoid sharing memory by communication (don't communicate by sharing memory)
- Check for race conditions on shared state

#### Resource Management
- Use defer for cleanup (file close, mutex unlock, response body close)
- Ensure HTTP response bodies are always closed
- Close channels from the sender side only

#### Code Quality
- Avoid package-level mutable state
- Use meaningful names (short names for short-lived variables, descriptive for long-lived)
- Keep interfaces small (prefer many small interfaces over large ones)
- Return structs, accept interfaces`,

  python: `#### Code Quality
- Use type hints for function signatures (PEP 484)
- Follow PEP 8 style guidelines
- Avoid wildcard imports (from module import *)
- Use f-strings instead of .format() or % formatting
- Avoid mutable default arguments (e.g., def foo(x=[]))

#### Error Handling
- Catch specific exceptions, not bare except: or except Exception
- Use context managers (with statement) for resource management
- Avoid silently swallowing exceptions
- Use custom exception classes for application-specific errors

#### Security
- Never use eval() or exec() with untrusted input
- Use parameterized queries for database operations (prevent SQL injection)
- Sanitize user input before rendering in templates (prevent XSS)
- Do not hardcode secrets, API keys, or passwords

#### Performance
- Use list comprehensions instead of loops for simple transformations
- Use generators for large datasets to avoid memory issues
- Avoid O(n^2) lookups (use sets/dicts for O(1) lookups)
- Use appropriate data structures (collections.deque for queues, heapq for priority queues)`,

  properties: `#### Typos
- Spelling errors in configuration keys or values

#### Configuration Errors
- Incorrect property values (wrong format, invalid range)
- Missing required properties
- Conflicting property definitions

#### Security
- Plaintext secrets, passwords, or API keys in properties files
- Database URLs with embedded credentials`,

  json: `#### Key Spelling
- Check JSON key spelling only (not values)
- Ensure consistent naming conventions (camelCase, snake_case)`,

  yaml: `#### Key Spelling
- Check YAML key spelling only (not values)
- Ensure consistent naming conventions
- Check for YAML-specific issues (indentation, quoting)`,

  xml: `#### SQL and Logic (for mapper/DAO XML)
- SQL spelling errors
- SQL logic errors (wrong joins, missing conditions)
- Performance issues (full table scans, missing indexes)
- SQL injection (\${} vs #{} parameter usage)
- Ensure proper namespace declarations`,

  arkts: `#### Obvious Typos or Spelling Errors
- Spelling errors in variable names, function names, component names, or property names
- Strings in log or error messages containing spelling errors

#### ArkTS Specific
- Follow ArkTS type system constraints
- Use @Entry, @Component, @Builder decorators correctly
- Proper state management (@State, @Prop, @Link, @Provide, @Consume)
- Avoid any type; use specific types
- Ensure UI state updates trigger re-renders correctly

#### Performance
- Avoid deep component nesting
- Use LazyForEach for large lists instead of ForEach
- Minimize state variable scope
- Use @Watch for computed properties appropriately`,
};

/**
 * Detect the review language from a file path extension.
 */
export function detectLanguage(filePath: string): ReviewLanguage {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const extMap: Record<string, ReviewLanguage> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mts: 'typescript',
    mjs: 'javascript',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    rs: 'rust',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    c: 'c',
    h: 'c',
    go: 'go',
    py: 'python',
    properties: 'properties',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    ets: 'arkts',
  };
  return extMap[ext] ?? 'default';
}

/**
 * Get the review rule text for a language.
 */
export function getReviewRule(language: ReviewLanguage): string {
  return rules[language] ?? rules.default;
}

/**
 * Get the review rule for a file path (auto-detects language).
 */
export function getReviewRuleForFile(filePath: string): string {
  return getReviewRule(detectLanguage(filePath));
}

/**
 * Get all supported languages.
 */
export function getSupportedLanguages(): ReviewLanguage[] {
  return Object.keys(rules) as ReviewLanguage[];
}
