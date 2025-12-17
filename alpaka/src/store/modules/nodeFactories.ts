import { Node } from "@xyflow/react";
import { getDefaultNodeParameters } from "@/config/defaultNodeParameters";

// Get API configuration from environment variables with defaults
const EXTERNAL_API_BASE_URL =
  process.env.NEXT_PUBLIC_EXTERNAL_API_URL || "http://localhost:3001";
const DEFAULT_API_SECRET = process.env.NEXT_PUBLIC_DEFAULT_API_SECRET || "";

// Helper function to create node by type
export function createNodeByType(
  type: string,
  id: string,
  position: { x: number; y: number },
  existingNodes: Node[],
): Node {
  switch (type) {
    case "basicLLMChain":
      return createBasicLLMChainNode(id, position, existingNodes);
    case "modelProvider":
      return createModelProviderNode(id, position, existingNodes);
    case "note":
      return createNoteNode(id, position, existingNodes);
    case "trigger":
      return createTriggerNode(id, position, existingNodes);
    case "outputSender":
      return createOutputSenderNode(id, position, existingNodes);
    default:
      return createNoteNode(id, position, existingNodes);
  }
}

// Helper function to generate unique node names
export const generateUniqueNodeName = (
  baseLabel: string,
  existingNodes: Node[],
): string => {
  const existingLabels = existingNodes
    .map((node) => (node.data?.label as string) || "")
    .filter((label) => label.startsWith(baseLabel));

  if (existingLabels.length === 0) {
    return baseLabel;
  }

  // Find the highest number suffix
  let maxNumber = 0;
  existingLabels.forEach((label) => {
    if (label === baseLabel) {
      maxNumber = Math.max(maxNumber, 1);
    } else {
      const match = label.match(
        new RegExp(
          `^${baseLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`,
        ),
      );
      if (match && match[1]) {
        maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
      }
    }
  });

  return `${baseLabel} ${maxNumber + 1}`;
};

// Helper function to generate unique numeric Group ID (1-9999)
export const generateUniqueGroupId = (existingNodes: Node[]): number => {
  // Собираем все существующие Group ID из Model Provider нод
  const existingGroupIds = existingNodes
    .filter((node) => node.type === "modelProvider")
    .map((node) => node.data?.groupId)
    .filter((id) => typeof id === "number" && id >= 1 && id <= 9999);

  if (existingGroupIds.length === 0) {
    return 1;
  }

  // Находим первый доступный ID от 1 до 9999
  for (let i = 1; i <= 9999; i++) {
    if (!existingGroupIds.includes(i)) {
      return i;
    }
  }

  // Если все ID заняты (что крайне маловероятно), возвращаем случайный
  return Math.floor(Math.random() * 9999) + 1;
};

// Node factory functions
export const createBasicLLMChainNode = (
  id: string,
  position: { x: number; y: number },
  existingNodes: Node[],
): Node => {
  // Find the first available model provider group or default to 1
  const existingProviders = existingNodes.filter(
    (n) => n.type === "modelProvider",
  );
  const firstProvider = existingProviders[0];
  const defaultModelGroup = firstProvider
    ? (firstProvider.data?.groupId as number) || 1
    : 1;

  return {
    id,
    type: "basicLLMChain",
    position,
    data: {
      id,
      type: "basicLLMChain",
      label: generateUniqueNodeName("LLM Chain", existingNodes),
      modelGroup: defaultModelGroup,
      messages: [
        {
          id: `msg_${Date.now()}`,
          role: "user",
          content: "",
        },
      ],
      isExecuting: false,
      lastResponse: undefined,
      lastThinking: undefined,
      lastError: undefined,
      executionStats: undefined,
      activeTab: "messages",
    },
  };
};

export const createModelProviderNode = (
  id: string,
  position: { x: number; y: number },
  existingNodes: Node[],
): Node => {
  // Use Group ID 1 for first Model Provider, otherwise find next available
  const existingProviders = existingNodes.filter(
    (n) => n.type === "modelProvider",
  );
  const groupId =
    existingProviders.length === 0 ? 1 : generateUniqueGroupId(existingNodes);

  const defaultProvider = "ollama";
  const defaultParams = getDefaultNodeParameters(defaultProvider);

  return {
    id,
    type: "modelProvider",
    position,
    data: {
      id,
      type: "modelProvider",
      label: generateUniqueNodeName("Model Provider", existingNodes),
      provider: defaultProvider,
      model: "",
      groupId: groupId,
      isCollapsed: false,
      ...defaultParams,
    },
    draggable: true,
    selectable: true,
    connectable: true,
  };
};

export const createTriggerNode = (
  id: string,
  position: { x: number; y: number },
  existingNodes: Node[],
): Node => ({
  id,
  type: "trigger",
  position,
  data: {
    id,
    type: "trigger",
    label: generateUniqueNodeName("API Trigger", existingNodes),
    triggerType: "webhook",
    config: {
      webhook: {
        url: `${EXTERNAL_API_BASE_URL}/api/external/jobs?status=queued`,
        method: "GET",
        headers: {
          "X-Alpaka-Secret": DEFAULT_API_SECRET,
        },
      },
    },
    isExecuting: false,
  },
});

export const createOutputSenderNode = (
  id: string,
  position: { x: number; y: number },
  existingNodes: Node[],
): Node => ({
  id,
  type: "outputSender",
  position,
  data: {
    id,
    type: "outputSender",
    label: generateUniqueNodeName("Output Sender", existingNodes),
    config: {
      baseUrl: EXTERNAL_API_BASE_URL,
      endpoint: "/api/external/jobs",
      method: "PATCH",
      secretKey: DEFAULT_API_SECRET,
      includeReports: true,
      autoSend: true,
    },
    mapping: {
      jobIdVariable: "job_id",
      statusVariable: "job_status",
      reports: {
        "Adapted Report": "adapted_report",
        "Professional Report": "professional_report",
        "Aggregate Score Profile": "aggregate_score_profile",
      },
    },
    isExecuting: false,
  },
});

export const createNoteNode = (
  id: string,
  position: { x: number; y: number },
  existingNodes: Node[],
  text?: string,
): Node => ({
  id,
  type: "note",
  position,
  data: {
    id,
    type: "note",
    label: generateUniqueNodeName("Note", existingNodes),
    content: text || "", // Start with empty content
    backgroundColor: "#fef3c7",
    textColor: "#92400e",
    fontSize: 14,
    isExecuting: false,
  },
});
