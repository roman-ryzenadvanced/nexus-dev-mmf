# Nexus-Dev MMFE — Architecture Reference

## Core Components

### Orchestrator (`src/core/orchestrator.ts`)

Central coordinator that manages the full pipeline lifecycle. Tracks pipeline state and delegates to specialized components.

### Decomposer (`src/decomposer/decomposer.ts`)

Uses `glm-5.2` to intelligently break down complex requests into independent subtasks. Falls back to a single-task strategy if decomposition fails.

### Adaptive Router (`src/router/adaptive-router.ts`)

The Adaptive Routing Layer (ARL) that scores each model against each subtask considering:

- **Capability match** — Does the model support what the subtask needs?
- **Mode alignment** — Does the model fit the execution mode (speed/quality/etc)?
- **Complexity alignment** — Is the model suited for the task's complexity?
- **Load balancing** — Are we overloading one model?
- **Priority weighting** — Critical tasks get quality-biased routing

### Parallel Executor (`src/core/executor.ts`)

Executes subtasks in parallel waves, respecting dependency ordering. Implements:

- Concurrency limiting
- Timeout handling
- Retry with alternative models
- Dependency graph resolution (topological sort)

### Synthesizer (`src/synthesis/synthesizer.ts`)

Merges all subtask results using `glm-5.2` for primary synthesis and `glm-4.7` for quality refinement. Includes:

- Self-assessed quality scoring (0-100)
- Automatic re-synthesis below quality threshold
- Failed subtask accommodation

## Data Flow

```
OrchestrationRequest
  │
  ▼
Decomposer.decompose()
  │ → SubTask[]
  ▼
AdaptiveRouter.route()
  │ → RoutingDecision[]
  ▼
ParallelExecutor.execute()
  │ → Map<SubTaskId, SubTaskResult>
  ▼
Synthesizer.synthesize()
  │ → OrchestrationResult
  ▼
Unified Answer
```

## Model Selection Logic

The ARL uses a weighted scoring system:

| Factor               | Weight            | Description                                       |
| -------------------- | ----------------- | ------------------------------------------------- |
| Capability match     | 40 points         | Full match = 40, partial = 20, poor = -10         |
| Mode preference      | 10-30 points      | Depends on mode (speed/quality/balanced/creative) |
| Complexity alignment | 0-20 points       | Matches complexity to model tier                  |
| Load balancing       | -3 per assignment | Penalizes overloaded models                       |
| Priority boost       | 0-10 points       | Critical tasks get quality boost                  |

The model with the highest composite score is selected. Confidence is derived from capability match ratio and overall score.
