export type ComputerActionRisk =
  | "READ_ONLY"
  | "ACTION"
  | "HIGH_IMPACT";

const COMPUTER_ACTION_RISKS: Record<
  string,
  ComputerActionRisk
> = {
  computer_get_status: "READ_ONLY",
  computer_list_applications: "READ_ONLY",
  computer_list_files: "READ_ONLY",
  computer_read_file: "READ_ONLY",

  computer_launch_application: "ACTION",
  computer_write_file: "ACTION",
};

export function getComputerActionRisk(
  toolName: string,
): ComputerActionRisk | undefined {
  return COMPUTER_ACTION_RISKS[toolName];
}

export function isComputerTool(
  toolName: string,
): boolean {
  return toolName in COMPUTER_ACTION_RISKS;
}

export function requiresComputerAuthorization(
  toolName: string,
): boolean {
  const risk = getComputerActionRisk(toolName);

  return (
    risk === "ACTION" ||
    risk === "HIGH_IMPACT"
  );
}