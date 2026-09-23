import { nodeCaption } from "@/workflow/labels";
import type { Workflow, WorkflowNode } from "@/workflow/schema";

type Traffic = {
  nodeId: string;
  blocked?: number;
  review?: number;
  paused?: number;
};

function stateFor(stopped: number, paused: number, hasTraffic: boolean) {
  if (stopped > 0) return { cls: "state-blocked", tag: `${stopped} stopped` };
  if (paused > 0) return { cls: "state-paused", tag: `${paused} waiting` };
  if (hasTraffic) return { cls: "state-passed", tag: "ok" };
  return { cls: "", tag: "" };
}

export function Pipeline({
  nodes,
  trigger,
  traffic = [],
}: {
  nodes: WorkflowNode[];
  trigger?: Workflow["trigger"];
  traffic?: Traffic[];
}) {
  const hasTraffic = traffic.length > 0;

  return (
    <ol className="pipeline">
      {trigger ? (
        <li className="step" style={{ animationDelay: "0ms" }}>
          <div className="kind trigger">LEAD</div>
          <div>
            <h3>New lead</h3>
            <p>{trigger.sheet} sheet</p>
          </div>
        </li>
      ) : null}
      {nodes.map((node, index) => {
        const caption = nodeCaption(node);
        const stats = traffic.find((item) => item.nodeId === node.id);
        const stopped = (stats?.blocked ?? 0) + (stats?.review ?? 0);
        const paused = stats?.paused ?? 0;
        const state = stateFor(stopped, paused, hasTraffic);
        return (
          <li
            key={node.id}
            className={`step ${state.cls}`}
            style={{ animationDelay: `${(index + (trigger ? 1 : 0)) * 90}ms` }}
          >
            <div className={`kind ${node.kind}`}>{caption.kind}</div>
            <div>
              <h3>
                {index + 1}. {caption.title}
              </h3>
              <p>{caption.sub}</p>
              {state.tag ? <span className="state-tag">{state.tag}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
