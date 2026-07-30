import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

export const SAFE_FIXTURE_ENVIRONMENT_NAMES = Object.freeze([
  "UI_EVIDENCE_AGENT_FLOW_ID",
  "UI_EVIDENCE_MODEL_ROUTER_ID",
  "UI_EVIDENCE_SCHEDULED_JOB_ID",
  "UI_EVIDENCE_SCHEDULED_JOB_RUN_ID",
]);

function safeEnvironment(environment) {
  return Object.fromEntries(
    SAFE_FIXTURE_ENVIRONMENT_NAMES.flatMap((name) => {
      const value = environment[name];
      return typeof value === "string" && value.trim()
        ? [[name, value.trim()]]
        : [];
    })
  );
}

function agentFlowsDirectory(repoRoot) {
  return path.join(repoRoot, "server", "storage", "plugins", "agent-flows");
}

function validAgentFlowId(repoRoot, id) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const file = path.join(agentFlowsDirectory(repoRoot), `${id}.json`);
  if (!existsSync(file)) return null;
  try {
    const flow = JSON.parse(readFileSync(file, "utf8"));
    return typeof flow?.name === "string" &&
      flow.name.trim() &&
      Array.isArray(flow.steps)
      ? id
      : null;
  } catch {
    return null;
  }
}

function firstAgentFlowId(repoRoot) {
  const directory = agentFlowsDirectory(repoRoot);
  if (!existsSync(directory)) return null;
  const files = readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && /^[A-Za-z0-9_-]{1,128}\.json$/.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    if (validAgentFlowId(repoRoot, id)) return id;
  }
  return null;
}

function positiveInteger(value) {
  return /^[1-9][0-9]*$/.test(value ?? "") ? Number(value) : null;
}

async function firstDatabaseFixtures(repoRoot, requested) {
  const clientModule = path.join(
    repoRoot,
    "server",
    "node_modules",
    "@prisma",
    "client"
  );
  if (!existsSync(clientModule)) {
    return {
      values: {},
      diagnostics: ["prisma-client-unavailable"],
    };
  }

  let prisma = null;
  try {
    const { PrismaClient } = require(clientModule);
    prisma = new PrismaClient({ log: [] });
    const requestedRouterId = positiveInteger(
      requested.UI_EVIDENCE_MODEL_ROUTER_ID
    );
    const requestedJobId = positiveInteger(
      requested.UI_EVIDENCE_SCHEDULED_JOB_ID
    );
    const requestedRunId = positiveInteger(
      requested.UI_EVIDENCE_SCHEDULED_JOB_RUN_ID
    );
    const router = await prisma.model_routers.findFirst({
      ...(requested.UI_EVIDENCE_MODEL_ROUTER_ID
        ? { where: { id: requestedRouterId ?? -1 } }
        : {}),
      orderBy: { id: "asc" },
      select: { id: true },
    });
    let job = requested.UI_EVIDENCE_SCHEDULED_JOB_ID
      ? await prisma.scheduled_jobs.findFirst({
          where: { id: requestedJobId ?? -1 },
          select: { id: true },
        })
      : null;
    let run = await prisma.scheduled_job_runs.findFirst({
      ...(requested.UI_EVIDENCE_SCHEDULED_JOB_RUN_ID
        ? { where: { id: requestedRunId ?? -1 } }
        : requested.UI_EVIDENCE_SCHEDULED_JOB_ID
          ? { where: { jobId: requestedJobId ?? -1 } }
          : {}),
      orderBy: { id: "asc" },
      select: { id: true, jobId: true },
    });
    const pairMismatch =
      Boolean(requested.UI_EVIDENCE_SCHEDULED_JOB_ID) &&
      Boolean(requested.UI_EVIDENCE_SCHEDULED_JOB_RUN_ID) &&
      job &&
      run &&
      job.id !== run.jobId;
    if (pairMismatch) run = null;
    if (!job && run) {
      job = await prisma.scheduled_jobs.findFirst({
        where: { id: run.jobId },
        select: { id: true },
      });
    }
    if (!job && !requested.UI_EVIDENCE_SCHEDULED_JOB_ID) {
      job = await prisma.scheduled_jobs.findFirst({
        orderBy: { id: "asc" },
        select: { id: true },
      });
    }
    return {
      values: {
        ...(router ? { UI_EVIDENCE_MODEL_ROUTER_ID: String(router.id) } : {}),
        ...(job ? { UI_EVIDENCE_SCHEDULED_JOB_ID: String(job.id) } : {}),
        ...(run
          ? {
              UI_EVIDENCE_SCHEDULED_JOB_ID: String(run.jobId),
              UI_EVIDENCE_SCHEDULED_JOB_RUN_ID: String(run.id),
            }
          : {}),
      },
      diagnostics: [
        router
          ? "model-router-found"
          : requested.UI_EVIDENCE_MODEL_ROUTER_ID
            ? "model-router-requested-missing"
            : "model-router-missing",
        job
          ? "scheduled-job-found"
          : requested.UI_EVIDENCE_SCHEDULED_JOB_ID
            ? "scheduled-job-requested-missing"
            : "scheduled-job-missing",
        run
          ? "scheduled-job-run-found"
          : requested.UI_EVIDENCE_SCHEDULED_JOB_RUN_ID
            ? "scheduled-job-run-requested-missing"
            : "scheduled-job-run-missing",
        ...(pairMismatch ? ["scheduled-job-run-pair-mismatch"] : []),
      ],
    };
  } catch {
    return {
      values: {},
      diagnostics: ["sqlite-read-failed"],
    };
  } finally {
    await prisma?.$disconnect();
  }
}

/**
 * Discover route identifiers using SELECT-only database queries and read-only
 * directory enumeration. The return value contains only allow-listed IDs.
 * It never enumerates, copies, logs, or returns authentication variables.
 */
export async function discoverReadOnlyFixtures({
  repoRoot,
  environment = process.env,
  inspectLocalData = true,
}) {
  const requested = safeEnvironment(environment);
  const values = inspectLocalData ? {} : { ...requested };
  const diagnostics = [];
  const sources = {};

  if (inspectLocalData) {
    const requestedFlowId = requested.UI_EVIDENCE_AGENT_FLOW_ID;
    const flowId = requestedFlowId
      ? validAgentFlowId(repoRoot, requestedFlowId)
      : firstAgentFlowId(repoRoot);
    if (flowId) {
      values.UI_EVIDENCE_AGENT_FLOW_ID = flowId;
      sources.UI_EVIDENCE_AGENT_FLOW_ID = requestedFlowId
        ? "process-environment-verified"
        : "filesystem-read-only";
      diagnostics.push("agent-flow-found");
    } else {
      diagnostics.push(
        requestedFlowId ? "agent-flow-requested-missing" : "agent-flow-missing"
      );
    }

    const database = await firstDatabaseFixtures(repoRoot, requested);
    diagnostics.push(...database.diagnostics);
    for (const [name, value] of Object.entries(database.values)) {
      values[name] = value;
      sources[name] =
        requested[name] === value
          ? "process-environment-verified"
          : "sqlite-select-only";
    }
  } else {
    for (const name of Object.keys(values)) {
      sources[name] = "process-environment-unverified";
    }
  }

  return {
    environment: values,
    sources,
    diagnostics: [...new Set(diagnostics)].sort(),
    readOnly: true,
  };
}
