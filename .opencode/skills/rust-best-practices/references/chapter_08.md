# Chapter 8 - Comments

> Clear code beats clear comments. However, when the why isn't obvious, comment it plainly - or link to where you can read more context.

## 8.1 Comment the _why_, not the _what_

A `//` comment earns its place when it captures reasoning that the code itself
cannot: a safety guarantee, a workaround, a performance tradeoff, or a link to
where the decision lives. Comments that restate _what_ the code does are noise -
they drift out of date and clutter the file.

| Use a `// comment` for                  | Avoid a comment when                        |
| --------------------------------------- | ------------------------------------------- |
| Explaining tricky reasoning (the _why_) | It just restates the code (the _what_)      |
| Safety guarantees, workarounds, gotchas | Better naming or a smaller function says it |
| Links to a Design Doc or ADR            | It will silently rot as the code evolves    |

## 8.2 When to use comments

Use `//` comments (double slashed) when something can't be expressed clearly in code, like:

- **Safety Guarantees**, some of which can be better expressed with code conditionals.
- Workarounds or **Optimizations**.
- Legacy or **platform-specific** behaviors. Some of them can be expressed with `#[cfg(..)]`.
- Links to **Design Docs** or **ADRs**.
- Assumptions or **gotchas** that aren't obvious.

> Name your comments! For example, a comment regarding a safety guarantee should start with `// SAFETY: ...`.

### ✅ Good comment:

```rust
// SAFETY: `ptr` is guaranteed to be non-null and aligned by caller
unsafe { std::ptr::copy_nonoverlapping(src, dst, len); }
```

### ✅ Design context comment:

```rust
// CONTEXT: Reuse root cert store across subgraphs to avoid duplicate OS calls:
// [ADR-12](link/to/adr-12): TLS Performance on MacOS
```

## 8.3 When comments get in the way

Avoid comments that:

- Restate obvious things (`// increment i by 1 for the next loop`).
- Can grow stale over time.
- `TODO`s without actions (links to some versioned issue).
- Could be replaced by better naming or smaller functions.

### ❌ Bad comment:

```rust
fn compute(counter: &mut usize) {
    // increment by 1
    *counter += 1;
}
```

### ❌ Too long or outdated

```rust
// Originally written in 2028 for some now-defunct platform
```

## 8.4 Don't Write "Living Documentation" in comments

Comments as a "living documentation" is a **dangerous myth**, as comments are **not free**:

- They **rot** - nobody compiles comments.
- They **mislead** - readers usually assume they are true with no critique, e.g. "the other developer knows this code better than I do".
- They **go stale** - unless maintained with the code, they become irrelevant.
- They are **noisy** - comments can clutter your code with multiple unnecessary lines.

If something deserves to live beyond a PR, put it in:

- An **ADR** (Architectural Design Record).
- A Design Document.
- Express it **in code** by using types, better names, or by extracting cleaner functions.
- Add tests to cover and explain the change.

> ### 🚨 If you find a comment, **read it in context**. Does it still make sense? If not, remove or update it, or ask for help. Comments should bother you.

## 8.5 Replace Comments with Code

Instead of long commented blocks, break logic into named helper functions:

#### ❌ Commented code block:

```rust
fn save_user(&self) -> Result<(), MyError> {
    // check if the user is authenticated
    if self.is_authenticated() {
        // serialize user data
        let data = serde_json::to_string(self)?;
        // write to file
        std::fs::write(self.path(), data)?;
    }
}
```

**✅ Extract for clarity**:

```rust
fn save_auth_user(&self) -> Result<PathBuf, MyError> {
    if self.is_authenticated() {
        let path = self.path();
        let serialized_user = serde_json::to_string(self)?;
        std::fs::write(path, serialized_user)?;
        Ok(path)
    } else {
        Err(MyError::UserNotAuthenticated)
    }
}
```

## 8.6 `TODO` should become issues

Don't leave `// TODO:` scattered around the codebase with no owner. Instead:

1. File Github Issue or Jira Ticket. (Prefer github issues on public repositories).
2. Reference the issue in the code:

```rust
// TODO(issue #42): Remove workaround after bugfix
```

This makes `TODO`s trackable, actionable and visible to everyone.
